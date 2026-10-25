# v1.2 — Recebimento fiscal, rastreabilidade de componentes e mídia de produto

Data: 24/10/2026 · Branch: `feat/recebimento-fiscal` (empilhado sobre `feat/producao`) ·
Pedido do usuário: "conclua o v1.2 e depois avance sobre 3.1". Specs decididas de forma
autônoma e registradas no ledger. Referência: `0_SUMARIO_EXECUTIVO.md` §4.1.1, §4.1.2, §4.3 e
o que a §4.4 exige deles (saldo por lote, FEFO, kardex).

## 1. Entregas (commits em sequência)

| # | Entrega | Conteúdo |
|---|---|---|
| R1 | Arquivos, flags e mídia de produto | Serviço de arquivos (bytea, decisão do usuário), anexos genéricos por entidade, flags de controle do item, foto principal + galeria e documentos PDF versionados de produtos e peças, miniaturas nos pontos de decisão. |
| R2 | Nota fiscal de entrada | De-para item × fornecedor, NF com vínculo ao PC **por item**, lotes e séries na digitação, validações, conferência, efetivação atômica, estorno, encerramento do PC com saldo pendente, CMP com rateio. RN-001: o recebimento direto do PC sai. |
| R3 | Importação do XML da NF-e | Leitura de cabeçalho, itens, totais e `rastro` (lotes); CNPJ do emitente x fornecedor do PC; itens reconhecidos pelo de-para, não reconhecidos vinculados à mão e memorizados. |
| R4 | Consumo rastreado e consultas | Reserva/consumo de lote por FEFO e de séries de componentes na OP; série do componente instalada na unidade (série pai); consultas equipamento → fornecedor, lote → campo, saldo → origem; kardex; vencimentos de lote e de documento. |

## 2. Decisões

- **Armazenamento**: arquivos em `bytea` no PostgreSQL (decisão do usuário), não em object
  storage. O resto do §4.1.2 vale: tipo real por *magic number*, SHA-256 (deduplicação e
  integridade), nome original só como metadado (id interno UUID), **URL assinada com expiração
  curta** (HMAC, 5 min) — nenhum arquivo por caminho público —, `Content-Disposition`,
  `X-Content-Type-Options: nosniff` e CSP `sandbox` na entrega. Limites: imagem 5 MB, PDF 25 MB,
  XML 2 MB. **Antivírus (ClamAV): fora** — infraestrutura; registrado.
- **Miniatura**: gerada no upload (JPG/PNG/WebP → JPG 240 px). Recorte/rotação no upload: só
  rotação de 90° no frontend antes de enviar; recorte fica de fora.
- **Flags do item** (§4.1.1) em partes/peças **e** produtos acabados: `controla_numero_serie`,
  `controla_lote`, `controla_validade` (só com lote), `item_critico` (foto principal
  obrigatória), `exige_certificado`; mais `validade_minima_dias` e `mascara_serie` (regex opcional).
- **Conversão de unidade**: no de-para (unidade do fornecedor + fator para a unidade de consumo).
- **NF × PC no item** (recomendação do §4.3.2): o cabeçalho tem um PC "principal"; cada item
  aponta para um item de PC (do mesmo fornecedor). Bonificação: item sem PC, com justificativa e
  valor zero, sem impacto no saldo do PC.
- **Divergência de preço**: parâmetro novo `tolerancia_preco_pct` e ação `BLOQUEAR` ou `APROVAR`
  (exige a permissão `notas_entrada.aprovar_divergencia` na efetivação).
- **Chave de acesso**: 44 dígitos com DV módulo 11; obrigatória no modelo 55; única. Sem chave:
  única por CNPJ emitente + modelo + série + número. Consulta à SEFAZ pela chave: fora (sem
  certificado digital) — a chave é digitada ou vem do XML.
- **CFOP de entrada aceitos**: 1101, 1102, 1111, 1116, 1120, 1122, 1124, 1126, 1401, 1403,
  1407, 1556, 1910, 1949 e os equivalentes 2xxx/3xxx (lista fechada no código).
- **Custo de entrada**: valor unitário + rateio de frete, seguro, IPI e ICMS-ST, menos desconto,
  proporcional ao valor de cada item; alimenta o CMP.
- **Estorno**: bloqueado se o material de algum item já foi reservado/consumido (saldo
  disponível menor que o recebido, série fora de "Em Estoque" ou lote consumido). Reverte o CMP.
- **RN-001**: o endpoint de recebimento direto do PC deixa de existir; entrada de insumo só por
  NF. O ajuste manual continua como origem controlada (permissão + motivo + auditoria) e, para
  item com lote/série, exige lote/séries — é também o caminho do **inventário de abertura**.
- **Estados da série de componente**: Em Estoque → Reservado → Consumido → Instalado (na série
  da unidade produzida); Sucateado por ajuste. RMA/devolução: fora (sem módulo de assistência).
- **Fora**: curva ABC, inventário rotativo, endereçamento por lote, devolução de cliente/RMA,
  antivírus, consulta SEFAZ, recorte de imagem.

## 3. Permissões (migration 018/019)

`notas_entrada.visualizar|lancar|efetivar|estornar|aprovar_divergencia`,
`pedidos_compra.encerrar`. `pedidos_compra.receber` passa a significar "lançar NF" e é
substituída por `notas_entrada.lancar` (mesmos perfis). Matriz: GESTOR tudo; ALMOXARIFE
visualizar/lancar/efetivar; COMPRADOR visualizar/lancar; CONSULTA visualizar; QUALIDADE
visualizar.
