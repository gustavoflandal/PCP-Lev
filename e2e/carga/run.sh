#!/usr/bin/env sh
# Teste de carga: sobe a stack isolada da suite E2E (banco novo), semeia
# volume (volume.sql) e roda o k6 com 30 usuarios simultaneos por ~3 min.
#   sh e2e/carga/run.sh            # derruba a stack no fim
#   MANTER=1 sh e2e/carga/run.sh
set -u
cd "$(dirname "$0")/../.."
RAIZ="$(pwd -W 2>/dev/null || pwd)"
export MSYS_NO_PATHCONV=1
COMPOSE="docker compose -p pcp-e2e -f docker-compose.yml -f e2e/docker-compose.e2e.yml"
$COMPOSE down -v --remove-orphans >/dev/null 2>&1
$COMPOSE up -d --build postgres backend frontend || exit 1
i=0
until curl -fsS http://127.0.0.1:8100/api/v1/saude >/dev/null 2>&1; do
  i=$((i + 1)); [ $i -gt 60 ] && { echo "API nao respondeu"; exit 1; }
  sleep 2
done
echo ">> semeando volume"
docker exec -i pcp_e2e_postgres psql -q -U pcp_user -d pcp_db -v ON_ERROR_STOP=1 < e2e/carga/volume.sql || exit 1
mkdir -p e2e/saida
docker run --rm --network pcp-e2e_default -v "$RAIZ/e2e/carga:/carga" grafana/k6:0.54.0 run --summary-trend-stats "avg,p(90),p(95),max" /carga/carga.js 2>&1 | tee e2e/saida/carga.txt
resultado=$?
[ "${MANTER:-0}" = "1" ] || $COMPOSE down -v --remove-orphans >/dev/null 2>&1
exit $resultado
