#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 <artifact-bucket> [artifact-key]

Ensures an S3 bucket exists in eu-west-1, packages the Lambda artefact, uploads
it, deploys CloudFormation and verifies the Lambda VPC/secret bindings.
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for post-deploy verification" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_BUCKET="$1"
ARTIFACT_KEY="${2:-lambda/api-lambda.zip}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
STACK_NAME="${STACK_NAME:-math-visuals-api}"
DATA_STACK_NAME="${DATA_STACK_NAME:-math-visuals-data}"
SHARED_PARAMETERS_STACK_NAME="${SHARED_PARAMETERS_STACK_NAME:-math-visuals-shared}"
STAGE_NAME="${STAGE_NAME:-prod}"
LAMBDA_ARTIFACT_PATH="$ROOT_DIR/infra/api/api-lambda.zip"
TEMPLATE_FILE="$ROOT_DIR/infra/api/template.yaml"

info() {
  echo "[cloudshell-deploy] $*"
}

ensure_bucket() {
  info "Ensuring artefact bucket '$ARTIFACT_BUCKET' exists in $AWS_REGION"
  if aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" 2>/dev/null; then
    bucket_region=$(aws s3api get-bucket-location --bucket "$ARTIFACT_BUCKET" --query 'LocationConstraint' --output text)
    if [[ "$bucket_region" == "None" ]]; then
      bucket_region="us-east-1"
    fi
    if [[ "$bucket_region" != "$AWS_REGION" ]]; then
      echo "Bucket exists in region $bucket_region, expected $AWS_REGION" >&2
      exit 1
    fi
  else
    if [[ "$AWS_REGION" == "us-east-1" ]]; then
      aws s3api create-bucket --bucket "$ARTIFACT_BUCKET"
    else
      aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" --region "$AWS_REGION" --create-bucket-configuration "LocationConstraint=$AWS_REGION"
    fi
  fi
}

package_lambda() {
  info "Packaging Lambda artefact"
  "$ROOT_DIR/scripts/package-api-lambda.sh" >/dev/null
}

upload_lambda() {
  info "Uploading artefact to s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY"
  aws s3 cp "$LAMBDA_ARTIFACT_PATH" "s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY"
}

deploy_stack() {
  info "Deploying CloudFormation stack $STACK_NAME"
  aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --region "$AWS_REGION" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
      LambdaCodeS3Bucket="$ARTIFACT_BUCKET" \
      LambdaCodeS3Key="$ARTIFACT_KEY" \
      StageName="$STAGE_NAME" \
      DataStackName="$DATA_STACK_NAME" \
      SharedParametersStackName="$SHARED_PARAMETERS_STACK_NAME"
}

verify_lambda() {
  info "Verifying Lambda configuration"
  AWS_REGION="$AWS_REGION" \
  STACK_NAME="$STACK_NAME" \
  DATA_STACK_NAME="$DATA_STACK_NAME" \
  "$ROOT_DIR/scripts/verify-api-lambda.sh"
}

ensure_bucket
package_lambda
upload_lambda
deploy_stack
verify_lambda

info "Deployment complete"
