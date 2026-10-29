# Publica o sistema no Docker local a partir do codigo atual.
# Sempre reconstroi as imagens (sem isso o container continua rodando o codigo
# da ultima construcao) e grava commit + data/hora na tela de entrada.
#   ./publicar.ps1            # desenvolvimento (docker-compose.yml)
#   ./publicar.ps1 -Prod      # producao (docker-compose.prod.yml + deploy/.env.prod)
param([switch]$Prod)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$env:PCP_VERSAO = (git rev-parse --short HEAD).Trim()
if (git status --porcelain) { $env:PCP_VERSAO += '+local' }
$env:PCP_PUBLICADO_EM = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

if ($Prod) {
    docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
} else {
    docker compose up -d --build
}
Write-Host "Publicado: $($env:PCP_VERSAO) em $($env:PCP_PUBLICADO_EM)"
