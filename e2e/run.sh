#!/usr/bin/env sh
# Suite E2E do Sistema PCP: sobe uma stack isolada (projeto Compose pcp-e2e,
# banco novo), roda os roteiros Playwright em ordem e derruba tudo no fim.
#
#   e2e/run.sh                      # suite inteira
#   e2e/run.sh producao recebimento # so alguns roteiros (nome sem "roteiro-")
#   MANTER=1 e2e/run.sh             # nao derruba a stack no fim
#
# Screenshots e o resumo ficam em e2e/saida/ (fora do controle de versao).
set -u
cd "$(dirname "$0")/.."
RAIZ="$(pwd -W 2>/dev/null || pwd)"
export MSYS_NO_PATHCONV=1
PROJETO=pcp-e2e
COMPOSE="docker compose -p $PROJETO -f docker-compose.yml -f e2e/docker-compose.e2e.yml"
IMAGEM_PW=mcr.microsoft.com/playwright:v1.49.1-noble
ORDEM="regional seguranca negocio smtp rbac usuarios clientes producao recebimento anexos paineis"
[ $# -gt 0 ] && ORDEM="$*"

sql() { docker exec -i pcp_e2e_postgres psql -q -U pcp_user -d pcp_db -v ON_ERROR_STOP=1 "$@"; }

echo ">> subindo a stack isolada ($PROJETO)"
$COMPOSE down -v --remove-orphans >/dev/null 2>&1
$COMPOSE up -d --build postgres backend frontend mailpit || exit 1
i=0
until curl -fsS http://127.0.0.1:8100/api/v1/saude >/dev/null 2>&1; do
  i=$((i + 1)); [ $i -gt 60 ] && { echo "API nao respondeu"; $COMPOSE logs backend | tail -30; exit 1; }
  sleep 2
done
sql < e2e/dados/usuarios-teste.sql || exit 1
mkdir -p e2e/saida

# Dependencias do Playwright (uma vez). Um CA local (antivirus com inspecao
# TLS) em backend/.docker-ca/*.crt e repassado ao npm.
if [ ! -d e2e/node_modules/playwright ]; then
  docker run --rm -v "$RAIZ/e2e:/e2e" -v "$RAIZ/backend/.docker-ca:/ca" -w /e2e $IMAGEM_PW \
    sh -c 'cat /ca/*.crt > /tmp/ca.pem 2>/dev/null; NODE_EXTRA_CA_CERTS=/tmp/ca.pem npm install --no-audit --no-fund' || exit 1
fi

falhas=""
: > e2e/saida/resumo.txt
ip=100
for r in $ORDEM; do
  ip=$((ip + 1))
  extra=""
  case $r in
    regional) sql < e2e/dados/regional.sql ;;
    negocio) sql < e2e/dados/negocio.sql ;;
    producao) sql < e2e/dados/producao.sql ;;
    recebimento) sql < e2e/dados/recebimento.sql ;;
    anexos)
      linha=$(sql -tA -c "SELECT o.id || ' ' || min(ns.numero) FROM ordens_producao o JOIN numeros_serie ns ON ns.ordem_producao_id = o.id WHERE o.status = 'Concluida' GROUP BY o.id ORDER BY o.id DESC LIMIT 1")
      extra="-e OP_ID=${linha%% *} -e SERIE=${linha#* }" ;;
  esac
  echo ">> roteiro $r"
  # shellcheck disable=SC2086
  # IP proprio por roteiro (sub-rede do docker-compose.e2e.yml): o limite de
  # tentativas de login e por IP e nao pode passar de um roteiro ao seguinte.
  if docker run --rm --network ${PROJETO}_default --ip 172.30.240.$ip -e TZ=America/Sao_Paulo $extra \
      -v "$RAIZ/e2e:/e2e" -v "$RAIZ/e2e/saida:/shots" -w /e2e $IMAGEM_PW node roteiros/roteiro-$r.mjs > e2e/saida/$r.log 2>&1; then
    echo "   ok -- $(tail -1 e2e/saida/$r.log)" | tee -a e2e/saida/resumo.txt
  else
    echo "   FALHOU -- $(tail -1 e2e/saida/$r.log) (ver e2e/saida/$r.log)" | tee -a e2e/saida/resumo.txt
    falhas="$falhas $r"
  fi
done

[ "${MANTER:-0}" = "1" ] || $COMPOSE down -v --remove-orphans >/dev/null 2>&1
if [ -n "$falhas" ]; then echo ">> falharam:$falhas"; exit 1; fi
echo ">> suite E2E ok"
