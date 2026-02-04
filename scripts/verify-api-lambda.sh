#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: ${0##*/}

Validates that the deployed API Lambda function uses the expected VPC subnets,
security group and Redis secret/parameter bindings.

Configuration is controlled via the following environment variables:
  AWS_REGION                   AWS region that hosts the stacks (default: eu-west-1)
  STACK_NAME                   CloudFormation stack that hosts the API Lambda (default: math-visuals-api)
  DATA_STACK_NAME              CloudFormation stack that exports the VPC/Redis resources (default: math-visuals-data)
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to verify the Lambda configuration" >&2
  exit 1
fi

AWS_REGION="${AWS_REGION:-eu-west-1}"
STACK_NAME="${STACK_NAME:-math-visuals-api}"
DATA_STACK_NAME="${DATA_STACK_NAME:-math-visuals-data}"

info() {
  echo "[verify-api-lambda] $*"
}

stack_output() {
  local stack_name="$1"
  local key="$2"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey==\`$key\`].OutputValue" \
    --output text
}

info "Fetching expected VPC and secret bindings from stack '$DATA_STACK_NAME' in $AWS_REGION"
subnet1=$(stack_output "$DATA_STACK_NAME" PrivateSubnet1Id)
subnet2=$(stack_output "$DATA_STACK_NAME" PrivateSubnet2Id)
lambda_sg=$(stack_output "$DATA_STACK_NAME" LambdaSecurityGroupId)
redis_secret=$(stack_output "$DATA_STACK_NAME" RedisPasswordSecretName)
redis_endpoint_param=$(stack_output "$DATA_STACK_NAME" RedisEndpointParameterName)
redis_port_param=$(stack_output "$DATA_STACK_NAME" RedisPortParameterName)

if [[ -z "$subnet1" || -z "$subnet2" || -z "$lambda_sg" ]]; then
  echo "One or more VPC outputs are missing from stack '$DATA_STACK_NAME'" >&2
  exit 1
fi

info "Looking up Lambda function deployed by stack '$STACK_NAME'"
function_physical_id=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --logical-resource-id ApiFunction \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text)

if [[ -z "$function_physical_id" ]]; then
  echo "Unable to resolve ApiFunction physical ID from stack '$STACK_NAME'" >&2
  exit 1
fi

lambda_config=$(aws lambda get-function-configuration \
  --function-name "$function_physical_id" \
  --region "$AWS_REGION")

mapfile -t lambda_subnets < <(echo "$lambda_config" | jq -r '.VpcConfig.SubnetIds[]?')
mapfile -t lambda_sgs < <(echo "$lambda_config" | jq -r '.VpcConfig.SecurityGroupIds[]?')

errors=0

contains_value() {
  local needle="$1"
  shift
  for value in "$@"; do
    if [[ "$value" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

if ! contains_value "$subnet1" "${lambda_subnets[@]}"; then
  echo "Missing subnet $subnet1 in Lambda VpcConfig" >&2
  errors=$((errors + 1))
fi
if ! contains_value "$subnet2" "${lambda_subnets[@]}"; then
  echo "Missing subnet $subnet2 in Lambda VpcConfig" >&2
  errors=$((errors + 1))
fi
if ! contains_value "$lambda_sg" "${lambda_sgs[@]}"; then
  echo "Missing Lambda security group $lambda_sg" >&2
  errors=$((errors + 1))
fi

redis_password_env=$(echo "$lambda_config" | jq -r '.Environment.Variables.REDIS_PASSWORD // ""')
redis_endpoint_env=$(echo "$lambda_config" | jq -r '.Environment.Variables.REDIS_ENDPOINT // ""')
redis_port_env=$(echo "$lambda_config" | jq -r '.Environment.Variables.REDIS_PORT // ""')

if [[ -n "$redis_secret" && "$redis_password_env" != *"$redis_secret"* ]]; then
  echo "REDIS_PASSWORD does not reference $redis_secret" >&2
  errors=$((errors + 1))
fi
if [[ -n "$redis_endpoint_param" && "$redis_endpoint_env" != *"$redis_endpoint_param"* ]]; then
  echo "REDIS_ENDPOINT does not reference $redis_endpoint_param" >&2
  errors=$((errors + 1))
fi
if [[ -n "$redis_port_param" && "$redis_port_env" != *"$redis_port_param"* ]]; then
  echo "REDIS_PORT does not reference $redis_port_param" >&2
  errors=$((errors + 1))
fi

if [[ $errors -gt 0 ]]; then
  echo "Lambda verification failed with $errors issue(s)" >&2
  exit 1
fi

info "Lambda VPC subnets, security group and Redis bindings verified in $AWS_REGION"
