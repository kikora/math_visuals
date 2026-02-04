#!/usr/bin/env bash
set -euo pipefail

ROLE_NAME="AWSServiceRoleForAppRunner"
SERVICE_NAME="apprunner.amazonaws.com"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Service-linked role '$ROLE_NAME' already exists; skipping creation."
  exit 0
fi

echo "Service-linked role '$ROLE_NAME' not found. Attempting to create it for $SERVICE_NAME..."

if aws iam create-service-linked-role --aws-service-name "$SERVICE_NAME" >/dev/null 2>&1; then
  echo "Created service-linked role '$ROLE_NAME'."
else
  status=$?
  echo "Failed to create service-linked role '$ROLE_NAME'. Ensure the IAM principal has iam:CreateServiceLinkedRole permissions (see infra/README.md)." >&2
  exit "$status"
fi
