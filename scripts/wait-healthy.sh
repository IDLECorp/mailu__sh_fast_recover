#!/usr/bin/env bash
set -euo pipefail

container="${1:?usage: wait-healthy.sh <container> [retries=30] [delay_s=2] [port=3000]}"
retries="${2:-30}"
delay="${3:-2}"
port="${4:-3000}"

for i in $(seq 1 "$retries"); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo unknown)"
  if [[ "$status" == "healthy" ]]; then
    echo "$container: docker healthy (intento $i)"
    if docker exec "$container" wget -qO- "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      echo "$container: HTTP up en :${port}/health"
      exit 0
    fi
    echo "$container: docker healthy pero HTTP todavia no responde, reintentando..."
  elif [[ "$status" != "unknown" ]]; then
    echo "$container: estado=$status (intento $i)"
  fi
  sleep "$delay"
done

echo "ERROR: $container no responde healthy tras ${retries} intentos" >&2
exit 1