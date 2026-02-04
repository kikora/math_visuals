#!/usr/bin/env bash
set -euo pipefail

STACK_NAME=${1:-}

if [[ -z "$STACK_NAME" ]]; then
  echo "Usage: $0 <stack-name>" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI must be available to delete rollback-complete stacks." >&2
  exit 1
fi

describe_output=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>&1)
describe_exit=$?

if [[ $describe_exit -ne 0 ]]; then
  if [[ "$describe_output" == *"does not exist"* ]]; then
    echo "Stack $STACK_NAME does not exist; nothing to clean up."
    exit 0
  fi

  echo "Unable to describe stack $STACK_NAME (exit code $describe_exit). Proceeding without cleanup." >&2
  exit 0
fi

status=$describe_output
echo "Stack $STACK_NAME status: $status"

if [[ "$status" == *"ROLLBACK"* && "$status" == *"IN_PROGRESS"* ]]; then
  echo "Rollback is still in progress for $STACK_NAME. Waiting for completion before cleanup..."
  if aws cloudformation wait stack-rollback-complete --stack-name "$STACK_NAME"; then
    status=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query 'Stacks[0].StackStatus' \
      --output text)
    echo "Rollback completed. Current status: $status"
  else
    echo "Rollback waiter failed; proceeding with best-effort cleanup." >&2
  fi
fi

if [[ -z "$status" || "$status" == "None" ]]; then
  echo "Stack $STACK_NAME does not exist; nothing to clean up."
  exit 0
fi

case "$status" in
  ROLLBACK_COMPLETE|ROLLBACK_FAILED|ROLLBACK_IN_PROGRESS|UPDATE_ROLLBACK_IN_PROGRESS|UPDATE_ROLLBACK_FAILED|UPDATE_ROLLBACK_COMPLETE|UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS|IMPORT_ROLLBACK_IN_PROGRESS|IMPORT_ROLLBACK_COMPLETE|IMPORT_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS|IMPORT_ROLLBACK_FAILED|CREATE_FAILED|DELETE_FAILED)
    echo "Stack $STACK_NAME is in non-updatable state $status. Deleting so it can be recreated..."
    aws cloudformation delete-stack --stack-name "$STACK_NAME"
    echo "Waiting for stack deletion to finish..."
    if aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"; then
      echo "Stack $STACK_NAME deleted."
    else
      echo "Stack $STACK_NAME deletion failed; please investigate in the AWS console." >&2
      exit 0
    fi
    ;;
  *)
    echo "Stack $STACK_NAME status is $status; no deletion required."
    ;;
esac
