#!/usr/bin/env bash
# Print step durations, queue time, and total wall time for a GitHub Actions run.
# Queue and total come from the job's own timestamps, so reruns are measured per attempt.
# Usage: scripts/ci-timings.sh <run-id> [attempt]
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "usage: $0 <run-id> [attempt]" >&2
  exit 1
fi

attempt=${2:-$(gh api "repos/{owner}/{repo}/actions/runs/$1" --jq .run_attempt)}
job_id=$(gh api "repos/{owner}/{repo}/actions/runs/$1/attempts/$attempt/jobs" --jq '.jobs[] | select(.name == "test") | .id')

gh api "repos/{owner}/{repo}/actions/jobs/$job_id" --jq '
  def secs: fromdateiso8601;
  (.steps[] | select(.started_at != null and .completed_at != null)
    | "\(.name)\t\((.completed_at | secs) - (.started_at | secs))"),
  "queue time\t\((.started_at | secs) - (.created_at | secs))",
  "total wall time\t\((.completed_at | secs) - (.created_at | secs))"
' | awk -F '\t' '{ printf "%-50s %4s s\n", $1, $2 }'
