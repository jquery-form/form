#!/usr/bin/env bash
# Print step durations, queue time, and total wall time for a GitHub Actions run.
# Usage: scripts/ci-timings.sh <run-id>
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <run-id>" >&2
  exit 1
fi

gh run view "$1" --json createdAt,jobs --jq '
  def secs: fromdateiso8601;
  . as $run
  | .jobs[] | select(.startedAt != null) as $job
  | ($job.steps[] | select(.startedAt != null and .completedAt != null)
      | "step\t\(.name)\t\((.completedAt | secs) - (.startedAt | secs))"),
    "queue time\t\t\(($job.startedAt | secs) - ($run.createdAt | secs))",
    "total wall time\t\t\(($job.completedAt | secs) - ($run.createdAt | secs))"
' | awk -F '\t' '{ name = ($1 == "step") ? $2 : $1; printf "%-50s %4s s\n", name, $3 }'
