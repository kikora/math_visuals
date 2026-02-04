#!/usr/bin/env bash
set -euo pipefail

STACK_NAME=${1:-}
REGION=${AWS_REGION:-}
MAX_WAIT_SECONDS=${MAX_WAIT_SECONDS:-1800}
POLL_INTERVAL_SECONDS=${POLL_INTERVAL_SECONDS:-30}

if [ -z "$STACK_NAME" ]; then
  echo "Usage: $0 <stack-name>" >&2
  exit 1
fi

start_time=$(date +%s)

get_status() {
  local status
  if ! status=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackStatus' \
    --output text 2> >(tee /tmp/wait-stack-error.log >&2)); then
    if grep -q "does not exist" /tmp/wait-stack-error.log; then
      echo "STACK_STATUS=NOT_FOUND"
      return 0
    fi
    echo "Failed to describe stack $STACK_NAME" >&2
    return 1
  fi
  echo "STACK_STATUS=$status"
}

while true; do
  status_output=$(get_status) || exit 1
  status=${status_output#STACK_STATUS=}

  case "$status" in
    NOT_FOUND)
      echo "Stack $STACK_NAME does not exist; nothing to wait for."
      exit 0
      ;;
    *_FAILED|*ROLLBACK*)
      echo "Stack $STACK_NAME is in a failed state: $status" >&2
      exit 1
      ;;
    *_IN_PROGRESS)
      elapsed=$(( $(date +%s) - start_time ))
      if [ "$elapsed" -ge "$MAX_WAIT_SECONDS" ]; then
        echo "Timed out waiting for $STACK_NAME to stabilize (last status: $status)" >&2
        exit 1
      fi
      echo "Stack $STACK_NAME is $status; waiting ${POLL_INTERVAL_SECONDS}s before rechecking..."
      sleep "$POLL_INTERVAL_SECONDS"
      ;;
    *)
      echo "Stack $STACK_NAME is stable: $status"
      exit 0
      ;;
  esac
done
