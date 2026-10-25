#!/bin/sh
# Restaura um backup do servico "backup" SOBRE o banco atual (apaga e recria
# os objetos). Uso, a partir da raiz do projeto:
#   sh deploy/restaurar.sh backups/pcp_20261024_020000.dump
# O script para a API durante a restauracao e a sobe de novo no fim.
set -eu
[ $# -eq 1 ] && [ -f "$1" ] || { echo "uso: $0 backups/arquivo.dump"; exit 1; }
COMPOSE=${PCP_COMPOSE:-"docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod"}
nome=$(basename "$1")
echo "Restaurar $nome? O conteudo atual do banco sera SUBSTITUIDO."
printf 'Digite RESTAURAR para confirmar: '
read -r confirma
[ "$confirma" = "RESTAURAR" ] || { echo "cancelado"; exit 1; }
$COMPOSE stop backend
# --role: os objetos voltam com o dono certo (o papel da aplicacao).
$COMPOSE exec -T backup sh -c \
  "pg_restore --clean --if-exists --no-owner --role=\"\$(psql -tAc 'SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()')\" -d \"\$PGDATABASE\" /backups/$nome"
$COMPOSE start backend
echo "Restaurado. Versao do schema: $($COMPOSE exec -T backup psql -tAc 'SELECT max(id) FROM schema_version')"
