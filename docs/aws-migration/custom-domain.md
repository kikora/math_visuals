# Migrating the custom domain to AWS Route 53 and ACM

This guide documents the manual steps required to move the `mathvisuals.no`
custom domain over to AWS, issue a TLS certificate, and attach the domain to the
static-site CloudFront distribution. All commands assume that you already have
AWS CLI credentials with access to the production account and that the
`math-visuals-static-site` stack has been deployed. Adapt the values (domain,
stack names, regions) if you are working in another environment.

> **Automation shortcut** – The helper script
> [`infra/static-site/bin/setup-custom-domain.sh`](../../infra/static-site/bin/setup-custom-domain.sh)
> implements the steps below. Run it from the repository root to request/lookup
> the ACM certificate in `eu-west-1`, create/locate the Route 53 hosted zone,
> update the CloudFront distribution aliases and certificate, and upsert alias
> A/AAAA records that point `mathvisuals.no` at CloudFront:
>
> ```bash
> infra/static-site/bin/setup-custom-domain.sh
> ```
>
> Export `CUSTOM_DOMAIN`, `ALT_NAMES`, `HOSTED_ZONE_ID`, `DISTRIBUTION_ID`, or
> `STACK_NAME` before running the script to override the defaults. The helper
> writes the ACM validation CNAMEs to
> `certificate-validation-records.json` and the hosted-zone name servers to
> `nameservers.json` so you can finish any manual validation steps.

## 1. Request and validate an ACM certificate

CloudFront only accepts certificates in the `eu-west-1` region. Use the
[`phase1.md`](./phase1.md) instructions to request a public certificate for your
root domain and any required subdomains. The snippet below mirrors the commands
from that document:

```bash
CUSTOM_DOMAIN=mathvisuals.no
ACM_REGION=eu-west-1

CERTIFICATE_ARN=$(aws acm request-certificate \
  --region "$ACM_REGION" \
  --domain-name "$CUSTOM_DOMAIN" \
  --subject-alternative-names "www.$CUSTOM_DOMAIN" "app.$CUSTOM_DOMAIN" \
  --validation-method DNS \
  --idempotency-token mathvisuals \
  --query 'CertificateArn' \
  --output text)

aws acm describe-certificate \
  --certificate-arn "$CERTIFICATE_ARN" \
  --region "$ACM_REGION" \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord'
```

The `describe-certificate` output prints the CNAME records ACM needs for DNS
validation. Create the records in Route 53 (or your external DNS) before moving
on. The certificate status changes to `ISSUED` once the validation records have
propagated.

## 2. Create/transfer the Route 53 hosted zone

1. In the AWS Console, navigate to **Route 53 → Hosted zones** and create a new
   public hosted zone for `mathvisuals.no`.
2. Copy the four name servers that Route 53 assigns to the zone.
3. If the domain is still managed by another registrar, update the domain's
   nameserver records to the Route 53 values so AWS can serve DNS.
4. Re-create any existing records (MX, TXT, etc.) in the hosted zone before
   cutting over traffic.

## 3. Attach the custom domain to CloudFront

After the certificate is issued and the hosted zone is ready, update the static
site distribution so it knows about the custom domain and certificate. The
commands are the same as those documented in `phase1.md`:

```bash
CLOUDFRONT_REGION=eu-west-1
DISTRIBUTION_ID=<distribution-id>

aws cloudfront get-distribution-config \
  --id "$DISTRIBUTION_ID" \
  --region "$CLOUDFRONT_REGION" \
  > cf.json

ETAG=$(jq -r '.ETag' cf.json)
jq '.DistributionConfig' cf.json > cf-config.json

jq \
  --arg domain "$CUSTOM_DOMAIN" \
  --arg cert "$CERTIFICATE_ARN" \
  '.Aliases = { Quantity: 1, Items: [$domain] } |
   .ViewerCertificate = { ACMCertificateArn: $cert, SSLSupportMethod: "sni-only", MinimumProtocolVersion: "TLSv1.2_2021" }' \
  cf-config.json > cf-config-updated.json

aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file://cf-config-updated.json \
  --region "$CLOUDFRONT_REGION"
```

## 4. Point DNS at the distribution

Create alias A/AAAA records so the custom domain resolves to the CloudFront
distribution's domain name (`d123.cloudfront.net`). The alias target's hosted
zone ID must be the global CloudFront zone (`Z2FDTNDATAQYW2`). Example from
`phase1.md`:

```bash
HOSTED_ZONE_ID=<route53-hosted-zone-id>
DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.DomainName' --output text)

cat <<'JSON' > change-batch.json
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "mathvisuals.no",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "DIST_DOMAIN_PLACEHOLDER",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
JSON

sed -i "s/DIST_DOMAIN_PLACEHOLDER/$DIST_DOMAIN/" change-batch.json

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file://change-batch.json
```

Repeat the UPSERT for an `AAAA` record if IPv6 support is required. Once the
alias records propagate, browsing to `https://mathvisuals.no` should hit the
CloudFront distribution using the ACM certificate you provisioned.
