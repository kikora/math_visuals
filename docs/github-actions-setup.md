# GitHub Actions setup guide

Denne veiledningen beskriver hvordan du setter opp GitHub Actions for Math Visuals-prosjektet. Den bygger videre på arbeidsflytene som allerede ligger i repositoriet og forklarer hvilke secrets, AWS-roller og tilganger som trengs for å kjøre test- og deploy-pipelines.

## 1. Oversikt over workflowene

| Workflow | Fil | Trigger | Formål |
| --- | --- | --- | --- |
| CI | `.github/workflows/test.yml` | `pull_request`, `push` til `main` | Installerer Node 20, kjører `npm ci`, henter Playwright-avhengigheter og kjører `npm test`. Brukes for å verifisere endringer før de merges. |
| Deploy infrastructure | `.github/workflows/deploy-infra.yml` | `push` til `main`, `workflow_dispatch` | Pakker Lambda-koden, laster opp artefaktet til S3 og deployer CloudFormation-stakkene for data, API og statisk nettsted. Avslutter med CloudFront-invalidering hvis en distribusjons-ID er satt. |

> Tips: Aktiver `Require status checks to pass before merging` på `main`-grenen slik at CI-workflowen må være grønn før en PR kan merges.

## 2. Konfigurer GitHub Actions i repositoriet

1. Gå til **Settings → Actions → General** og verifiser at Actions er slått på for hele organisasjonen eller repoet.
2. Under **Workflow permissions** velger du *Read and write permissions* og krysser av for *Allow GitHub Actions to create and approve pull requests*. Dette er nødvendig når workflowen skal oppdatere cachefiler eller skrive logs tilbake til PR-er.
3. Legg til secrets og eventuelle repository-variabler under **Settings → Secrets and variables → Actions**. Tabellen i [README](../README.md#påkrevde-secrets) oppsummerer alle nøklene som må være på plass for `deploy-infra.yml`. Sett også `API_ARTIFACT_VERSION` dersom du ønsker å låse deployet til et spesifikt objektversjon i S3.

### Hent secrets fra AWS i CloudShell

Kjør skriptet `scripts/cloudshell-export-actions-secrets.sh` i AWS CloudShell for å hente verdiene workflowen trenger. Skriptet oppdager nå automatisk både GitHub OIDC-rollen (søker etter en rolle som har `token.actions.githubusercontent.com` som federated principal) og standardbøtta for Lambda-artefaktet fra CloudFormation-outputs, slik at du ofte kan kjøre det uten noen flagg. Det bruker fortsatt `math-visuals-shared` og `math-visuals-static-site` som standard stack-navn, og gir en tydelig advarsel hvis CloudFront-/S3-stacken mangler slik at du kan fylle inn `STATIC_SITE_*` manuelt.

```bash
# Full autodeteksjon når du står i riktig AWS-konto/region
scripts/cloudshell-export-actions-secrets.sh

# Tilpass hvis du bruker andre stack-navn eller region
REGION=eu-west-1 SHARED_STACK=annet-navn STATIC_STACK=annet-navn \
  scripts/cloudshell-export-actions-secrets.sh
```

#### Feilsøking

* Static stack-navnet kan være `math-visuals-static-site` (CloudFront + S3) eller `math-visuals-static` (tidligere oppsett). Hvis autodeteksjon ikke finner verdier, sett `STATIC_STACK` eksplisitt til riktig navn.
* Hvis skriptet ikke klarer å autodetektere OIDC-rollen, inspiser rollene i kontoen for å finne ARN-en som peker på GitHub OIDC-provider:

  ```bash
  aws iam list-roles | jq '.Roles[] | select(.AssumeRolePolicyDocument.Statement[].Principal.Federated // "" | contains("token.actions.githubusercontent.com")) | .Arn'
  ```

  Bruk ARN-en fra utskriften som `AWS_IAC_ROLE_ARN` når du kjører skriptet.

Skriptet skriver `KEY=VALUE`-linjer du kan lime direkte inn som repo-secrets i GitHub.

## 3. Opprett IAM-rolle for OIDC

Workflowen `deploy-infra.yml` bruker GitHub OIDC for å anta en IAM-rolle i AWS. Du kan opprette rollen med AWS CLI (erstatt variablene med egne verdier):

```bash
ACCOUNT_ID=123456789012
ROLE_NAME=MathVisualsGithubDeploy
REPO_NAME=org-navn/math_visuals

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document "$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${REPO_NAME}:ref:refs/heads/main"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
JSON
)"
```

Legg til flere referanser (for eksempel `ref:refs/heads/*` eller `pull_request`) dersom du ønsker at andre grener skal kunne kjøre deploy-workflowen.

### Ferdig CloudShell-skript

Kjør `scripts/cloudshell-create-oidc-role.sh` direkte i CloudShell for å opprette/oppdatere rollen, knytte den nødvendige inline-policyen og skrive ut ARN-en du skal lime inn som `AWS_IAC_ROLE_ARN` i GitHub-secrets. Skriptet henter kontonummer automatisk med `aws sts get-caller-identity`, finner repo-navnet fra `git remote` (fallbakken er `kikora/math_visuals`), bruker rollenavnet `MathVisualsGithubDeploy` og bruker `ref:refs/heads/main` som standard for trust policy-suben.

```bash
cd math_visuals
./scripts/cloudshell-create-oidc-role.sh
```

### Tildele nødvendige policyer

Rollen må kunne opprette og oppdatere alle ressursene som beskrives i CloudFormation-maler under `infra/`. Det enkleste er å knytte en administrativ policy under oppsettet, men du kan låse den til det som faktisk trengs:

* `cloudformation:*` på stakkene `math-visuals-shared`, `math-visuals-data`, `math-visuals-api` og `math-visuals-static`.
* `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` på bøtta som lagrer Lambda-artefakter og den statiske siden.
* `secretsmanager:PutSecretValue`, `secretsmanager:GetSecretValue` på hemmeligheten som deles mellom stackene.
* `ssm:PutParameter`, `ssm:GetParameter` på Parameter Store-verdiene for Redis og CORS.
* CloudFront-tilganger for både opprinnelseskontroller og den eldre origin access identity-ressursen: `cloudfront:CreateCloudFrontOriginAccessIdentity`, `cloudfront:DeleteCloudFrontOriginAccessIdentity`, `cloudfront:GetCloudFrontOriginAccessIdentity`, `cloudfront:GetCloudFrontOriginAccessIdentityConfig`, `cloudfront:ListCloudFrontOriginAccessIdentities`, `cloudfront:UpdateCloudFrontOriginAccessIdentity`, `cloudfront:CreateOriginAccessControl`, `cloudfront:DeleteOriginAccessControl`, `cloudfront:GetOriginAccessControl`, `cloudfront:GetOriginAccessControlConfig`, `cloudfront:ListOriginAccessControls`, `cloudfront:UpdateOriginAccessControl`, `cloudfront:GetDistribution`, `cloudfront:GetDistributionConfig`, `cloudfront:CreateDistribution`, `cloudfront:UpdateDistribution`, `cloudfront:ListDistributions`, `cloudfront:TagResource` og `cloudfront:CreateInvalidation`.
* `iam:*` på ressursene som deklareres i malene (Lambda-rollen i `infra/api/template.yaml` og eventuelle CloudFront-oppsett).
* `elasticache:CreateReplicationGroup`, `elasticache:ModifyReplicationGroup`, `elasticache:DescribeReplicationGroups`,
  `elasticache:DescribeCacheClusters`, `elasticache:CreateCacheSubnetGroup`, `elasticache:ModifyCacheSubnetGroup`,
  `elasticache:DescribeCacheSubnetGroups`, `elasticache:DeleteCacheSubnetGroup`, `elasticache:AddTagsToResource`,
  `elasticache:RemoveTagsFromResource` og `elasticache:ListTagsForResource` for å opprette og oppdatere Redis-ressursene i
  `infra/data/template.yaml`.
* `memorydb:*`, `ec2:*`, `elasticloadbalancing:*`, `logs:*` osv. ettersom datastacken oppretter VPC, subnett, sikkerhetsgrupper og en administrert Redis-klynge.

Når rollen er på plass legger du ARN-en inn i repo-secretet `AWS_IAC_ROLE_ARN`. Husk også å sette `AWS_REGION` til regionen stackene lever i.

## 4. Verifisere oppsettet

1. Lag en PR for å trigge CI-workflowen og kontroller at `CI`-jobben kjører `npm test` uten å kreve secrets.
2. Merg eller push til `main` (eller kjør `Deploy infrastructure` manuelt) og se at jobben pakker Lambda-koden (`scripts/package-api-lambda.sh`), laster opp til S3 og deployer CloudFormation-stakkene uten feilmeldinger.
3. Bekreft at Secrets Manager og Parameter Store er oppdatert med nye Redis-verdier, og at CloudFront-invalideringen fullføres.
4. Aktiver varsler i GitHub under **Settings → Actions → Notifications** hvis du ønsker e-post ved feil.

Når alle steg fungerer kan hele teamet jobbe gjennom PR-er i GitHub. Workflowen tar seg av testing, bygging og distribusjon så lenge secrets og IAM-rollen er på plass.
