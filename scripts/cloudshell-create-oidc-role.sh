#!/usr/bin/env bash
set -euo pipefail

ROLE_NAME="MathVisualsGithubDeploy"
DEFAULT_BRANCH_PATTERN="refs/heads/main"
DEFAULT_REPO_NAME="kikora/math_visuals"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI må være installert i CloudShell." >&2
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
REGION=$(aws configure get region || true)
REGION=${REGION:-eu-west-1}

if git remote get-url origin >/dev/null 2>&1; then
  REMOTE_URL=$(git remote get-url origin)
else
  REMOTE_URL=""
fi

if [[ -z "${REPO_NAME:-}" ]]; then
  if [[ "$REMOTE_URL" =~ github.com[:/]+([^/]+)/([^/.]+)(\.git)?$ ]]; then
    REPO_NAME="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  else
    REPO_NAME="$DEFAULT_REPO_NAME"
  fi
fi

BRANCH_PATTERN="${BRANCH_PATTERN:-$DEFAULT_BRANCH_PATTERN}"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
OIDC_PROVIDER="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

TRUST_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Federated": "${OIDC_PROVIDER}"},
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

POLICY_DOCUMENT=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "secretsmanager:PutSecretValue",
        "secretsmanager:GetSecretValue",
        "ssm:PutParameter",
        "ssm:GetParameter",
        "cloudfront:CreateInvalidation",
        "cloudfront:CreateFunction",
        "cloudfront:DeleteFunction",
        "cloudfront:DescribeFunction",
        "cloudfront:ListFunctions",
        "cloudfront:PublishFunction",
        "cloudfront:UpdateFunction",
        "cloudfront:GetFunction",
        "cloudfront:CreateCloudFrontOriginAccessIdentity",
        "cloudfront:DeleteCloudFrontOriginAccessIdentity",
        "cloudfront:ListCloudFrontOriginAccessIdentities",
        "cloudfront:GetCloudFrontOriginAccessIdentity",
        "cloudfront:GetCloudFrontOriginAccessIdentityConfig",
        "cloudfront:UpdateCloudFrontOriginAccessIdentity",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:GetOriginAccessControlConfig",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:ListOriginAccessControls",
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:ListDistributions",
        "cloudfront:TagResource",
        "iam:*",
        "memorydb:*",
        "elasticache:CreateCacheSubnetGroup",
        "elasticache:DeleteCacheSubnetGroup",
        "elasticache:DescribeCacheSubnetGroups",
        "elasticache:ModifyCacheSubnetGroup",
        "elasticache:CreateReplicationGroup",
        "elasticache:DeleteReplicationGroup",
        "elasticache:DescribeCacheClusters",
        "elasticache:DescribeReplicationGroups",
        "elasticache:ListTagsForResource",
        "elasticache:ModifyReplicationGroup",
        "elasticache:AddTagsToResource",
        "elasticache:RemoveTagsFromResource",
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

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Oppdaterer trust policy for $ROLE_NAME ..."
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY"
else
  echo "Oppretter IAM-rolle $ROLE_NAME i $ACCOUNT_ID ..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "GitHub Actions deploy role for ${REPO_NAME}"
fi

echo "Oppdaterer inline policy..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${ROLE_NAME}DeploymentPolicy" \
  --policy-document "$POLICY_DOCUMENT"

echo "\nRolle klar: $ROLE_ARN"
echo "Region: $REGION"
echo "Repo: $REPO_NAME"
echo "Branch-mønster: $BRANCH_PATTERN"
