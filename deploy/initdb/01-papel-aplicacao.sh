#!/bin/sh
# Roda uma unica vez, na criacao do volume do banco (docker-entrypoint-initdb.d).
# Cria o papel com que a API conecta: dono do banco (as migrations criam as
# tabelas), mas sem superusuario -- quem obtiver essa senha nao le arquivos do
# servidor, nao executa comandos (COPY ... PROGRAM) nem cria outros papeis.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$APP_DB_USER" -v app_senha="$APP_DB_PASSWORD" -v banco="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_senha' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER DATABASE :"banco" OWNER TO :"app_user";
ALTER SCHEMA public OWNER TO :"app_user";
SQL
