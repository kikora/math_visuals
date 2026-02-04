# Manuell opplasting av statisk innhold til AWS

Denne veiledningen beskriver hvordan du kan publisere innholdet i `public/` til en S3-bøtte og koble den til en eksisterende CloudFront-distribusjon når GitHub Actions ikke er tilgjengelig. Fremgangsmåten er nyttig i en overgangsfase der infrastrukturen allerede er på plass, men du må fylle bøtta eller teste direkte fra CloudShell.

## Forutsetninger

* AWS-kontoen har CloudFront-distribusjonen klar og riktig DNS peker mot den.
* AWS CLI er installert (CloudShell har CLI ferdig konfigurert).
* Du har IAM-tilgang til å opprette og konfigurere S3-bøtter, samt oppdatere CloudFront.
* Prosjektet er bygget lokalt slik at mappen `public/` er fylt med oppdaterte filer.

## 1. Bygg statiske filer

Kjør byggesteget fra prosjektroten slik at `public/` inneholder de ferske filene.

```bash
npm run build
```

## 2. Sett miljøvariabler i CloudShell

I hver CloudShell-økt må du eksportere regioner og identifikatorer slik at CLI-kommandoene gjenbruker dem.

```bash
export AWS_REGION=eu-west-1
export AWS_PAGER=""
export CLOUDFRONT_REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
export ACCOUNT_ID
BUCKET_NAME=<ditt-bucket-navn>
```

`CLOUDFRONT_REGION` er alltid `us-east-1`, mens `AWS_REGION` samsvarer med regionen der S3-bøtta skal ligge. `BUCKET_NAME` bør være globalt unikt.

### Hente hemmeligheter til `.env`

Når du trenger lokale miljøvariabler til bygging eller validering kan du hente dem fra AWS Secrets Manager og Parameter Store med skriptet `scripts/export-secrets.sh`. Det støtter både rene strengverdier og JSON-objekter (som splittes til `KEY=VALUE` per felt).

```bash
./scripts/export-secrets.sh \
  --secret math-visuals/prod/oauth \
  --ssm /math-visuals/prod/feature-flags > .env
```

Feil på enkeltnøkler logges til stderr (nyttig ved manglende tilgang), men henting fortsetter for de øvrige nøklene.

## 3. Opprett bøtta, aktiver versjonering og synkroniser filer

```bash
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

aws s3 sync public/ "s3://$BUCKET_NAME/" --delete
```

`--delete` sørger for at objekter som er fjernet lokalt også fjernes i bøtta. Versjoneringen gjør det mulig å rulle tilbake om nødvendig.

## 4. Knytt bøtta til CloudFront via Origin Access Control

Hvis CloudFront-distribusjonen ikke allerede bruker OAC må du opprette den og sette en streng bøttepolicy slik at kun CloudFront har lesetilgang.

```bash
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config 'Name=MathVisualsOAC,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3' \
  --region "$CLOUDFRONT_REGION" \
  --query 'OriginAccessControl.Id' --output text)

DISTRIBUTION_ID=<eksisterende-distribusjons-id>
DISTRIBUTION_ARN="arn:aws:cloudfront::$ACCOUNT_ID:distribution/$DISTRIBUTION_ID"

cat <<'POLICY' > bucket-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::<bucket-navn>/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
        }
      }
    }
  ]
}
POLICY

sed -i "s/<bucket-navn>/$BUCKET_NAME/g" bucket-policy.json
sed -i "s|arn:aws:cloudfront::<account-id>:distribution/<distribution-id>|$DISTRIBUTION_ARN|" bucket-policy.json

aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file://bucket-policy.json
```

Oppdater CloudFront-distribusjonen slik at opprinnelsen bruker OAC-en (via konsollen eller `update-distribution`). Husk å lagre `OAC_ID` – den trengs når opprinnelsen oppdateres.

## 5. Verifiser at filene er tilgjengelige

Når policyen er på plass kan du bekrefte at CloudFront får tilgang, men du kan også teste direkte i bøtta for å se at filene ligger der.

```bash
aws s3 ls "s3://$BUCKET_NAME/sortering.html"
```

Svar med `PRE` eller `2024-..` bekrefter at objektet finnes. Full sluttest er å åpne CloudFront-URL-en i nettleseren og kontrollere at applikasjonen laster.

## 6. Opprydding

Fjern `bucket-policy.json` og eventuelle midlertidige filer fra arbeidsmappen når du er ferdig:

```bash
rm -f bucket-policy.json
```

## Feilsøking

| Problem | Tiltak |
| --- | --- |
| `BucketAlreadyOwnedByYou` | Bøtten finnes allerede i regionen – hopp over `create-bucket` og gå rett til versjonering og sync. |
| `AccessDenied` ved `put-bucket-policy` | Kontroller at `ACCOUNT_ID`, `DISTRIBUTION_ID` og regionene er riktige, og at du bruker en rolle med S3/CloudFront-fullmakter. |
| CloudFront returnerer 403 | Sjekk at opprinnelsen bruker OAC-en og at policyen peker på riktig ARN. Invalidér distribusjonen hvis du fortsatt ser gammelt innhold. |

Med denne prosessen kan du manuelt fylle bøtta uten å vente på CI/CD. Når GitHub Actions er tilbake, sørg for at hemmelighetene matcher `BUCKET_NAME`, `DISTRIBUTION_ID` og OAC-oppsettet du laget her.
