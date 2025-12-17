# Infrastructure configuration

This repository contains multiple CloudFormation/SAM templates under `infra/`.
`shared-parameters.yaml` acts as a lightweight coordination layer that keeps the
Secrets Manager and Systems Manager parameter names consistent across stacks.

## Shared parameter stack

Deploy the shared parameter template once per environment before any other
stacks that consume the values:

```bash
aws cloudformation deploy \
  --stack-name math-visuals-shared \
  --template-file infra/shared-parameters.yaml \
  --parameter-overrides EnvironmentName=prod
```

The stack exports the canonical names for the Redis connection secrets/parameters
and the frontend origin allow-lists. Other templates import these exports by
passing `SharedParametersStackName=math-visuals-shared`.

## Setting secret and parameter values before deployment

The consuming stacks use dynamic references to resolve the values at deploy
and runtime. The shared template now seeds the Redis secret with an empty JSON
payload so the `AWSCURRENT` version is immediately available, but you still
need to overwrite it with the real password. Make sure the Secrets Manager
secret and SSM parameters exist (and contain the latest values) **before**
deploying the API, static site or data stacks:

Use the helper script to update the Redis secrets and the frontend allow-list in
one go:

```bash
./scripts/update-shared-params.sh
```

Override the defaults by exporting the environment variables beforehand, e.g.

```bash
SHARED_STACK=math-visuals-shared-staging SHARED_REGION=eu-west-1 \
STATIC_STACK=math-visuals-static-site-staging STATIC_REGION=eu-west-1 ./scripts/update-shared-params.sh
```

The script:

1. Defaults to the production stack/region names (`math-visuals-shared`,
   `math-visuals-static-site`, `eu-west-1`) but respects any of the
   `SHARED_STACK`, `STATIC_STACK`, `SHARED_REGION` and `STATIC_REGION`
   environment variables you export before running it.
2. Looks up the Secrets Manager/Parameter Store resource names from CloudFormation
   outputs, fetches the current Redis password/endpoint/port values, prompts for
   overrides and then writes the values back to Secrets Manager/SSM.
3. Resolves the CloudFront domain from the static stack, writes the required
   allow-list (`https://<domain>,https://mathvisuals.no,https://app.mathvisuals.no`)
   to a temporary file and updates both
   `EXAMPLES_ALLOWED_ORIGINS`/`SVG_ALLOWED_ORIGINS` via file-based input so the
   AWS CLI never tries to fetch HTTPS URLs during validation.
4. Prints a masked summary of the values that should be mirrored to the
   `REDIS_*` GitHub Action secrets.

All infrastructure now runs in `eu-west-1` to keep Secrets Manager, SSM,
Lambda/API and the static site in the same region. Using explicit region
variables in the scripts still makes it clear which AWS calls talk to which
stack, but they default to this single region.

Repeat the `put-secret-value` and `put-parameter` commands whenever the Redis or
allowed-origins configuration changes. The next deployment will automatically
pick up the updated values because the templates resolve them dynamically.

When the data stack is not in use, the shared stack still provisions the Redis
secret/parameters. You can update the values directly via
`scripts/update-shared-params.sh` by pointing it at the shared stack/region and
skipping any data stack overrides:

```bash
SHARED_STACK=math-visuals-shared SHARED_REGION=eu-west-1 ./scripts/update-shared-params.sh
```

The script will prompt for the Redis password, endpoint and port and write them
to the newly created Secrets Manager/SSM resources exported as
`*-RedisPasswordSecretName`, `*-RedisEndpointParameterName` and
`*-RedisPortParameterName` respectively.

## CloudShell helper for validating the examples API

Operators can sanity-check the deployed `/api/examples` endpoint directly from
AWS CloudShell with `scripts/cloudshell-check-examples.sh`. The script looks up
the Redis connection info from the data stack (defaults to
`math-visuals-data`) and runs `npm run check-examples-api` with the correct
`REDIS_*` environment variables in place.

You can pass `--region`, `--stack` and `--url` manually, or simply rely on the
defaults. When `API_URL`/`--url` is omitted, the script now auto-detects the
CloudFront hostname by querying the `CloudFrontDistributionDomainName` output on
the static site stack (defaults to `math-visuals-static-site`). Override the
lookup with `STATIC_STACK=<name>` or `--static-stack=<name>` whenever you need to
point at staging/preview environments.

### CI-integrasjon og nødvendige secrets

GitHub Actions-workflowen [`deploy-infra.yml`](../.github/workflows/deploy-infra.yml)
synkroniserer verdiene ovenfor automatisk før API-stacken deployes. Workflowen
bruker outputs fra `SharedParametersStackName` til å finne navnene på Secrets
Manager- og SSM-ressursene, og forventer at følgende GitHub Secrets er definert
under **Settings → Secrets and variables → Actions**:

| Secret | Hva den brukes til |
| --- | --- |
| `REDIS_PASSWORD` | JSON-feltet `authToken` som lagres i Secrets Manager og som også sendes inn som `RedisAuthToken` når datastacken deployes. |
| `REDIS_ENDPOINT` | Hostnavnet som skrives til Parameter Store slik at Lambda/APIGW kan slå det opp. |
| `REDIS_PORT` | Portnummeret som skrives til Parameter Store slik at klientene vet hvilken port Redis eksponerer. |

Disse hemmelighetene må være tilstede i CI-miljøet. Workflowen validerer at alle
tre er satt og avbryter før API-deployen dersom én mangler, slik at man slipper
å pushe en stack uten konsistente Redis-verdier.

### IAM-tilgang for GitHub Actions-rollen

`deploy-infra.yml` antar at IAM-rollen som actions-jobben overtar kan opprette
eventuelle tjenestekoblede roller som mangler. Hvis rollen ikke har
`iam:CreateServiceLinkedRole`, vil CloudFormation feile med meldingen

```
AccessDenied: policy in AWS Identity and Access Management does not allow
CreateServiceLinkedRole on arn:aws:iam::aws:policy/aws-service-role/ApprunnerServicePolicyForECRAccess
```

Løsning:

1. Gi GitHub Actions-rollen tillatelsen `iam:CreateServiceLinkedRole`
   (eventuelt begrenset til tjenesten `apprunner.amazonaws.com`).
2. Alternativt kan en administrator kjøre
   `aws iam create-service-linked-role --aws-service-name apprunner.amazonaws.com`
   én gang i kontoen. Når rollen `AWSServiceRoleForAppRunner` finnes fra før
   slipper senere deployer å forsøke å opprette den.

Workflowen kjører nå `scripts/ensure-apprunner-slr.sh` tidlig i pipeline for å
opprette rollen automatisk dersom den mangler. Når IAM-rollen som brukes av
GitHub Actions har `iam:CreateServiceLinkedRole`, vil deployen dermed selv-hele
uten manuell CloudShell-innblanding.

Hvis deployen feiler med `AccessDeniedException` på
`cognito-idp:DescribeUserPoolDomain` (typisk når API-stacken slår opp Cognito-
domeneinformasjon), mangler GitHub Actions-rollen tilsvarende tillatelse. Gi
rollen tilgang til `cognito-idp:DescribeUserPoolDomain` (eventuelt begrenset til
det spesifikke brukerpoolet/domenet). Du kan bekrefte tilgangen fra AWS
CloudShell ved å kjøre
`scripts/cloudshell-check-cognito-domain.sh --domain=<cognito-domain>`.

CloudFront-funksjonen som ruter frontend-banene deployes via
`AWS::CloudFront::Function`. CloudFormation trenger da tillatelse til å hente
eksisterende funksjonsversjoner med `cloudfront:GetFunction` når distribusjonen
oppdateres. Hvis GitHub Actions-rollen mangler denne tillatelsen, ender stack-
oppdateringen i rollback med feilmeldingen:

```
Access denied for operation 'AWS::CloudFront::Function: ... is not authorized
to perform: cloudfront:GetFunction on resource: arn:aws:cloudfront::<account>:
function/<name> because no identity-based policy allows the
cloudfront:GetFunction action
```

Løsning: legg til en policy på GitHub Actions-rollen som gir
`cloudfront:GetFunction` (eventuelt begrenset til funksjonen
`math-visuals-static-site-viewer-router`). Når tilgangen er på plass vil neste
deploy fullføre uten rollback.
