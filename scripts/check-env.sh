#!/usr/bin/env bash
set -euo pipefail

required_file="${1:-env.required}"
env_file="${2:-.env}"

if [[ ! -f "$required_file" ]]; then
  echo "ERROR: archivo $required_file no encontrado" >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "ERROR: $env_file no existe (debe crearse SOLO en el VPS, nunca en git)" >&2
  exit 1
fi

missing=()
empty=()
while IFS= read -r line; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" ]] && continue
  var="${line%%=*}"
  val="${line#*=}"
  if ! grep -qE "^${var}=" "$env_file"; then
    missing+=("$var")
  elif [[ -z "${val}" ]] && ! grep -qE "^${var}=.+" "$env_file"; then
    empty+=("$var")
  fi
done < "$required_file"

status=0
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: Variables faltantes en $env_file:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  status=1
fi
if [[ ${#empty[@]} -gt 0 ]]; then
  echo "WARN: Variables vacias en $env_file:" >&2
  printf '  %s\n' "${empty[@]}" >&2
fi
if [[ $status -eq 0 ]]; then
  total=$(grep -cE '^[A-Za-z_]+=' "$required_file" || echo 0)
  echo "OK: $env_file contiene las $total variables requeridas"
fi
exit $status