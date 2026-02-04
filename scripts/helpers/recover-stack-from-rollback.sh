#!/usr/bin/env bash
set -euo pipefail

STACK_NAME=${1:-}

if [[ -z "$STACK_NAME" ]]; then
  echo "Usage: $0 <stack-name>" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI must be available to recover stack rollbacks." >&2
  exit 1
fi

status=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || true)

if [[ -z "$status" || "$status" == "None" ]]; then
  echo "Stack $STACK_NAME does not exist; skipping recovery."
  exit 0
fi

case "$status" in
  UPDATE_ROLLBACK_FAILED|ROLLBACK_FAILED|IMPORT_ROLLBACK_FAILED)
    echo "Stack $STACK_NAME is in $status. Attempting to continue rollback before deploying..."
    aws cloudformation continue-update-rollback --stack-name "$STACK_NAME"
    echo "Waiting for rollback to complete..."
    if ! aws cloudformation wait stack-rollback-complete --stack-name "$STACK_NAME"; then
      echo "Rollback waiter reported failure; checking final status..." >&2
    fi
    final_status=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query 'Stacks[0].StackStatus' \
      --output text)

    case "$final_status" in
      ROLLBACK_COMPLETE|UPDATE_ROLLBACK_COMPLETE|IMPORT_ROLLBACK_COMPLETE)
        echo "Stack $STACK_NAME recovered to $final_status."
        ;;
      *)
        echo "Stack $STACK_NAME finished in unexpected status: $final_status" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "Stack $STACK_NAME status is $status; no recovery needed."
    ;;
esac
