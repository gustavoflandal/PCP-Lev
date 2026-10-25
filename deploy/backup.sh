#!/bin/sh
# Backup diario do banco (servico "backup" do docker-compose.prod.yml), no
# formato custom do pg_dump (restaura com deploy/restaurar.sh). Roda todo dia
# na hora BACKUP_HORA e apaga os arquivos com mais de BACKUP_RETENCAO_DIAS.
#   sh /backup.sh agora   -> um backup imediato e sai
set -eu
HORA=${BACKUP_HORA:-02}
RETENCAO=${BACKUP_RETENCAO_DIAS:-14}

fazer_backup() {
  arquivo="/backups/pcp_$(date +%Y%m%d_%H%M%S).dump"
  if pg_dump -Fc -f "$arquivo.parcial"; then
    mv "$arquivo.parcial" "$arquivo"
    echo "$(date '+%F %T') backup ok: $arquivo ($(du -h "$arquivo" | cut -f1))"
  else
    rm -f "$arquivo.parcial"
    echo "$(date '+%F %T') ERRO no backup" >&2
    return 1
  fi
  find /backups -name 'pcp_*.dump' -mtime +"$RETENCAO" -print -delete
}

if [ "${1:-}" = "agora" ]; then
  fazer_backup
  exit $?
fi

echo "backup diario as ${HORA}h, retencao de ${RETENCAO} dias"
while true; do
  agora=$(date +%s)
  alvo=$(date -d "$(date +%Y-%m-%d) ${HORA}:00:00" +%s)
  [ "$alvo" -le "$agora" ] && alvo=$((alvo + 86400))
  sleep $((alvo - agora))
  fazer_backup || true
done
