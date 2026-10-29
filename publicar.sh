#!/bin/sh
# Publica o sistema no Docker local a partir do codigo atual (ver publicar.ps1).
#   ./publicar.sh          # desenvolvimento
#   ./publicar.sh --prod   # producao
set -e
cd "$(dirname "$0")"

PCP_VERSAO=$(git rev-parse --short HEAD)
[ -n "$(git status --porcelain)" ] && PCP_VERSAO="${PCP_VERSAO}+local"
PCP_PUBLICADO_EM=$(date -u +%Y-%m-%dT%H:%M:%SZ)
export PCP_VERSAO PCP_PUBLICADO_EM

if [ "$1" = "--prod" ]; then
  docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
else
  docker compose up -d --build
fi
echo "Publicado: $PCP_VERSAO em $PCP_PUBLICADO_EM"
