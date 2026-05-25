#!/usr/bin/env bash
# Ejecuta SQL contra Supabase usando el Management API + PAT.
#
# Uso:
#   ./supabase/sql.sh "select * from projects limit 5"
#   ./supabase/sql.sh < migrations/0001_projects_members_invitations.sql
#   echo "select auth.uid()" | ./supabase/sql.sh
#
# Requiere:
#   demo-app/.env.supabase-admin con:
#     SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxx
#     SUPABASE_PROJECT_REF=dlctkyxmfcdpwdiekvyy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.supabase-admin"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Falta $ENV_FILE" >&2
  echo "Crea el archivo con:" >&2
  echo "  SUPABASE_ACCESS_TOKEN=sbp_tu_token" >&2
  echo "  SUPABASE_PROJECT_REF=dlctkyxmfcdpwdiekvyy" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN no definido}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF no definido}"

# Lee SQL de argv o stdin
if [[ $# -gt 0 ]]; then
  SQL="$*"
else
  SQL="$(cat)"
fi

# Envía como JSON usando jq para escapar correctamente
PAYLOAD=$(jq -nc --arg q "$SQL" '{query: $q}')

curl -sS \
  -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  | jq '.'
