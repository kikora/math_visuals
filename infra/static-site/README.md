# Static site infrastructure

This directory contains an AWS CloudFormation template for provisioning the
infrastructure required to host the math visuals static site.

## What the template creates

The [`template.yaml`](./template.yaml) file configures the following resources:

- A versioned S3 bucket for storing the compiled `public/` artefacts.
- A CloudFront distribution fronting the bucket, including an origin access
  control so that the bucket can remain private without exposing public ACLs.
- Behaviours that route API-backed paths to an API Gateway origin while letting
  `/sortering` paths resolve to S3 objects.

### CloudFront behaviours

| Path pattern            | Origin             | Query string forwarding |
| ----------------------- | ------------------ | ----------------------- |
| `/api/*`                | API Gateway origin | Yes                     |
| `/bildearkiv/*`         | API Gateway origin | Yes                     |
| `/svg/*`                | API Gateway origin | Yes                     |
| `/figure-library/*`     | API Gateway origin | Yes                     |
| `/figure-library/*.js`  | S3 static assets   | No                      |
| `/sortering/eksempel*`  | S3 static assets   | Yes                     |
| `/sortering*`           | S3 static assets   | Yes                     |
| Default (`*`)           | S3 static assets   | No                      |

The template declares the API-backed behaviours first so CloudFront assigns them
the highest precedence. If the console ever shows the default `*` behaviour
listed above `/api/*`, redeploy the stack (or manually move `/api/*` to the top)
so API requests do not fall through to the S3 origin.

All API-backed behaviours use the managed **CachingDisabled** policy (overridable
via the `CachePolicyId` parameter) and allow the verbs `GET, HEAD, OPTIONS, PUT,
POST, PATCH, DELETE` so API Gateway can return dynamic JSON responses without
being cached at the edge.

Viewer request rewrites are handled by an attached CloudFront Function that
normalises "friendly" app routes (for example `/tenkeblokker/eksempel1`) to
their underlying HTML assets before the request reaches S3. This keeps deep
links to individual tools working even when the path omits the `.html`
extension or includes an example slug.

## Parameters

| Name                       | Description |
| -------------------------- | ----------- |
| `SiteEnvironmentName`      | Short environment identifier used for tagging (e.g. `prod`, `dev`). |
| `SiteBucketName`           | Globally unique name of the S3 bucket that will host the site. |
| `CreateSiteBucket`         | Set to `false` to reuse an existing bucket with the given name instead of creating a new one. |
| `ApiGatewayDomainName`     | Domain name of the API Gateway stage (e.g. `abc123.execute-api.us-east-1.amazonaws.com`). |
| `CloudFrontPriceClass`     | CloudFront price class to use (defaults to `PriceClass_100`). |
| `CachePolicyId`            | CloudFront cache policy applied to API-backed behaviours (defaults to the managed `CachingDisabled` policy). |
| `SharedParametersStackName`| Name of the stack created from `infra/shared-parameters.yaml`. |

## Outputs

The stack exports the following values for reuse by other stacks or deployment
steps:

- `StaticSiteBucketName` – the bucket that stores the static assets.
- `CloudFrontDistributionId` – identifier of the CloudFront distribution.
- `CloudFrontDistributionDomainName` – domain used to reach the distribution.

Derive `ApiGatewayDomainName` from the API stack's `ApiEndpoint` output by
stripping the scheme and stage path with a single backreference so CloudFront's
origin host remains valid:

Set `ApiGatewayOriginPath` to the API Gateway stage name (for example `/prod`
or `/dev`). Leaving it blank will cause CloudFront to call the stage-less
endpoint (e.g., `/api/examples`), which API Gateway treats as a 404 and the
SPA fallback rewrites to `index.html`. Keeping the origin path in sync with the
deployed stage prevents HTML responses from being cached for API calls.

```bash
API_STACK_NAME=${API_STACK_NAME:-math-visuals-api}

API_GATEWAY_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name "$API_STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text | sed -E 's|https://([^/]+)/.*|\1|')

# Validate the domain is an execute-api hostname without a protocol or path
if [[ ! "$API_GATEWAY_DOMAIN" =~ ^[A-Za-z0-9.-]+\.execute-api\.[A-Za-z0-9-]+\.amazonaws\.com$ ]]; then
  echo "Expected an execute-api host (got '$API_GATEWAY_DOMAIN')" >&2
  exit 1
fi
```

## Deploying the stack

Use the helper script to redeploy the stack with the latest template changes and
the parameter values that were already provisioned in AWS:

Prerequisites:

- AWS CLI v2 installed and available on your PATH
- `jq` installed (the deploy script uses it to inspect and reorder behaviours)
- A configured profile or environment credentials that can read the existing
  stack parameters and deploy CloudFormation resources
- A default region set (for example by exporting `AWS_DEFAULT_REGION=eu-west-1`)

```bash
# From the repository root
scripts/deploy-static-site.sh
```

The script reads the current parameter values for `SiteBucketName`,
`ApiGatewayDomainName`, `ApiGatewayOriginPath`, `CloudFrontPriceClass` and
`CachePolicyId` from the existing `math-visuals-static-site` stack before calling
[`aws cloudformation deploy`](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy/index.html)
against [`template.yaml`](./template.yaml). Passing `--force-upload` ensures
CloudFront receives the latest behaviours even when the parameter values do not
change. Override any of the values—along with `STACK_NAME`,
`SHARED_STACK_NAME`, or `TEMPLATE_FILE`—by exporting the matching environment
variables before running the script.

To override the cache policy used for API behaviours, export
`CACHE_POLICY_ID=<policy-id>` before running `scripts/deploy-static-site.sh`.
If you omit it the script reuses the value already stored on the stack (falling
back to the template default of `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` when the
stack is first created) so existing deployments continue to inherit AWS's
managed "CachingDisabled" policy.

After the deployment finishes the script prints the CloudFront distribution ID
and domain so you can immediately verify the behaviour updates. It also
confirms `/api/*` appears first in the behaviours list (reordering the
distribution if the console moved it) and validates the configured cache policy.
Unless `SKIP_INVALIDATION=1` is set it then invalidates `/api/*` and the SPA
fallback `/*`, logging the distribution ID and invalidated paths for
traceability.

### Allowing API write methods via CloudShell

If `/api/*` calls fail with `403 Forbidden` or `405 Method Not Allowed`, CloudFront
is likely blocking non-GET verbs. Run the CloudShell helper to expand the allowed
methods on every API-backed behaviour (including `/api/*`, `/bildearkiv/*`,
`/svg/*` and `/figure-library/*`):

```bash
scripts/cloudshell-enable-api-methods.sh
```

The script reads the CloudFront distribution ID from the
`math-visuals-static-site` stack, updates the `AllowedMethods` list to include
`GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE` for the API origin, and applies
the change with `aws cloudfront update-distribution`. Propagation can take a few
minutes before PUT/DELETE calls succeed globally.

### Troubleshooting missing `/api/*` routing

If `/api/examples` calls return a response from Amazon S3 (for example the
`Server: AmazonS3` header) instead of the Lambda/API Gateway origin, verify the
CloudFront behaviours in the AWS console:

1. Open CloudFront, select the distribution and switch to the **Behaviors** tab.
2. Confirm `/api/*` exists and its origin is set to the API Gateway domain—not
   the static S3 bucket.
3. Check the behaviour precedence: `/api/*` must appear above the default (`*`)
   rule so the API requests are evaluated before the static-site fallback.
4. Ensure the cache policy is **CachingDisabled** and allowed methods include
   `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`.

If any of these checks fail, update the behaviour in the console or redeploy the
stack with `scripts/deploy-static-site.sh --force-upload` so `/api/*` traffic is
routed back to the API origin.

### Verification

1. Confirm that the `/api/*` behaviour still targets the API Gateway origin.
   The script prints the distribution ID at the end of the deploy. If you need
   to look it up again, read it from the stack output before calling
   `aws cloudfront get-distribution-config`:

   ```bash
   STACK_NAME=${STACK_NAME:-math-visuals-static-site}
   CLOUDFRONT_REGION=us-east-1
   CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
     --stack-name "$STACK_NAME" \
     --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
     --output text)

   aws cloudfront get-distribution-config \
     --region "$CLOUDFRONT_REGION" \
     --id "$CLOUDFRONT_ID" \
     --query "DistributionConfig.CacheBehaviors.Items[?PathPattern=='/api/*'].{PathPattern:PathPattern,TargetOriginId:TargetOriginId}" \
     --output table
   ```

   The table must show `PathPattern` `/api/*` with `TargetOriginId`
   `ApiGatewayOrigin`.

2. Run the verification curls against the deployed CloudFront domain:

   #### Post-deploy actions

   Upload the refreshed static entry points to the site bucket using the
   `StaticSiteBucketName` stack output so the CloudFront origin serves the
   latest assets:

   ```bash
   STACK_NAME=${STACK_NAME:-math-visuals-static-site}
   STATIC_SITE_BUCKET=$(aws cloudformation describe-stacks \
     --stack-name "$STACK_NAME" \
     --query 'Stacks[0].Outputs[?OutputKey==`StaticSiteBucketName`].OutputValue' \
     --output text)

   aws s3 cp sortering.html "s3://$STATIC_SITE_BUCKET/sortering.html"
   aws s3 cp index.html "s3://$STATIC_SITE_BUCKET/index.html"
   ```

   The deploy script already issues an invalidation for `/api/*` and `/*` after
   reordering behaviours. If you skipped it, run the invalidation before
   re-running the curl checks:

   ```bash
   CLOUDFRONT_REGION=us-east-1
   CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
     --stack-name "$STACK_NAME" \
     --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
     --output text)

   aws cloudfront create-invalidation \
     --region "$CLOUDFRONT_REGION" \
     --distribution-id "$CLOUDFRONT_ID" \
     --paths "/api/*" "/*"
   ```

   ```bash
   STACK_NAME=${STACK_NAME:-math-visuals-static-site}
   CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
     --stack-name "$STACK_NAME" \
     --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionDomainName`].OutputValue' \
     --output text)

   curl -i "https://$CLOUDFRONT_DOMAIN/api/examples"
   curl -I "https://$CLOUDFRONT_DOMAIN/sortering/eksempel1"
   ```

The `/api/examples` call should return a `200` with
`content-type: application/json` and a JSON payload such as
`[{"id":"perlesnor","slug":"perlesnor","name":"Perlesnor"}, ...]`. The
`/sortering/eksempel1` request should return a `200 OK` from the S3 origin.
If `/api/examples` returns an error, the response should still include
`Content-Type: application/json` and a JSON body like
`{"error":"Not Found","message":"..."}` rather than HTML. This confirms that
both CloudFront routing and the Lambda handler wrap errors consistently.

### Troubleshooting: empty example lists

If the API returns data in CloudWatch but the frontend still shows an empty
examples list, double-check that the `/api/*` behaviour forwards query strings
to the API origin. In the CloudFront console, open **Behaviors**, select
`/api/*`, and set **Origin request policy** to **Managed-AllViewer** (or another
policy that forwards all query parameters). Save the change and wait a couple
of minutes for the distribution to propagate before retrying the page.

The outputs `ExamplesAllowedOriginsParameterName` and
`SvgAllowedOriginsParameterName` mirror the shared stack so that deployment
pipelines can retrieve the allow-list parameter names alongside the CloudFront
distribution metadata.
