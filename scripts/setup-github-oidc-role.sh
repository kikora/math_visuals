#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ACCOUNT_ID=123456789012 ROLE_NAME=MathVisualsGithubDeploy REPO_NAME=org/math_visuals [BRANCH_PATTERN=refs/heads/main] ./scripts/setup-github-oidc-role.sh

Environment variables:
  ACCOUNT_ID      AWS account ID that owns the OIDC provider and role.
  ROLE_NAME       Name of the IAM role to create.
  REPO_NAME       GitHub repository in the format org/repo.
  BRANCH_PATTERN  Branch reference pattern allowed to assume the role (default: refs/heads/main).

The script requires AWS CLI credentials with permission to manage IAM roles and policies.
USAGE
}

require_var() {
  local name="$1"
  local value="$2"

  if [ -z "$value" ]; then
    echo "Error: $name is required." >&2
    usage
    exit 1
  fi
}

if ! command -v aws >/dev/null 2>&1; then
  echo "This script requires the AWS CLI (aws) to be installed and configured." >&2
  exit 1
fi

ACCOUNT_ID="${ACCOUNT_ID:-}"
ROLE_NAME="${ROLE_NAME:-}"
REPO_NAME="${REPO_NAME:-}"
BRANCH_PATTERN="${BRANCH_PATTERN:-refs/heads/main}"

require_var "ACCOUNT_ID" "$ACCOUNT_ID"
require_var "ROLE_NAME" "$ROLE_NAME"
require_var "REPO_NAME" "$REPO_NAME"

TRUST_POLICY=$(cat <<JSON
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
          "token.actions.githubusercontent.com:sub": "repo:${REPO_NAME}:ref:${BRANCH_PATTERN}"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
JSON
)

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "IAM role $ROLE_NAME already exists, skipping creation."
else
  echo "Creating IAM role $ROLE_NAME with GitHub OIDC trust policy..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "GitHub Actions deploy role for ${REPO_NAME}"
fi

echo "Attaching inline deployment policy to $ROLE_NAME..."
POLICY_DOCUMENT=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "secretsmanager:PutSecretValue",
        "secretsmanager:GetSecretValue",
        "ssm:PutParameter",
        "ssm:GetParameter",
        "cloudfront:CreateCloudFrontOriginAccessIdentity",
        "cloudfront:DeleteCloudFrontOriginAccessIdentity",
        "cloudfront:GetCloudFrontOriginAccessIdentity",
        "cloudfront:GetCloudFrontOriginAccessIdentityConfig",
        "cloudfront:ListCloudFrontOriginAccessIdentities",
        "cloudfront:UpdateCloudFrontOriginAccessIdentity",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:GetOriginAccessControlConfig",
        "cloudfront:ListOriginAccessControls",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:ListDistributions",
        "cloudfront:TagResource",
        "cloudfront:CreateInvalidation",
        "iam:*",
        "memorydb:*",
        "ec2:*",
        "elasticloadbalancing:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
JSON
)

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${ROLE_NAME}DeploymentPolicy" \
  --policy-document "$POLICY_DOCUMENT"

echo "\nIAM role is ready. Add this secret to GitHub:"
echo "AWS_IAC_ROLE_ARN=${ROLE_ARN}"
