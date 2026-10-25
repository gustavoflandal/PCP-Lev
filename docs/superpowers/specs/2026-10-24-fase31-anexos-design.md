# Fase 3.1 — Anexos e Documentação Técnica (design)

Data: 24/10/2026. Pedido do usuário: "conclua o v1.2 e depois avance sobre 3.1".
Specs decididas de forma autônoma (decisão "Autônomo até o fim").

## Ponto de partida

A v1.2 (R1) já entregou o que o cronograma apontava como pendência de infraestrutura:

- serviço de arquivos em `bytea`, com deduplicação por SHA-256, miniaturas e URL assinada de 5 minutos;
- tabela `anexos` genérica para 9 entidades;
- permissões por entidade em `permissoesDeAnexo`;
- versionamento de documentos (`documento_chave` / `vigente`) e validade;
- painel de mídia de produto e peça, com fotos e documentos PDF.

Resta à 3.1 levar os anexos aos registros operacionais: OP, fornecedor, pedido de compra, pedido de venda e cliente. Também é preciso definir as regras de cada um.

## Escopo

### 1. Categorias por entidade (obrigatórias)

Nessas cinco entidades os anexos são do tipo `ANEXO` (qualquer formato aceito pelo serviço de arquivos, imagem ou PDF), e a categoria vem de uma lista fechada:

| Entidade | Categorias |
|---|---|
| Ordem de produção | Laudo de Teste, Relatório de Inspeção, Foto da Produção, Desenho/Esquema, Outro |
| Fornecedor | Contrato, Certificado de Qualidade, Documentos Cadastrais, Tabela de Preços, Outro |
| Pedido de compra | Proposta/Cotação, Pedido Assinado, Comunicação, Outro |
| Pedido de venda | Contrato/Edital, Pedido do Cliente, Termo de Aceite, Ordem de Serviço, Outro |
| Cliente | Contrato, Documentos Cadastrais, Termo de Aceite, Outro |

Os tipos `FOTO` e `DOCUMENTO` continuam exclusivos de produto e peça. Nas cinco entidades novas a API recusa os dois com 400.

### 2. Registro encerrado não perde anexo

Anexo de registro encerrado não pode ser removido (409 `ErrRegistroEncerrado`), mas ainda se pode anexar. Por exemplo, o termo de aceite chega depois da entrega. O documento vira registro de qualidade e de auditoria. Encerrado significa:

- OP `Concluida` ou `Cancelada`;
- PC `Concluido` ou `Cancelado`;
- PV `Entregue` ou `Cancelado`.

Fornecedor e cliente não têm estado de encerramento.

### 3. Vencimentos de documentos de todas as entidades

`GET /anexos/vencimentos` passa a incluir fornecedor (por exemplo, o certificado ISO) e cliente (contrato com vigência), além de produto e peça. Cada entidade só aparece para quem tem a permissão de visualizar dela. Sem nenhuma dessas permissões, a resposta é 403. O código exibido é a razão social, no caso de fornecedor e cliente.

### 4. Laudos na ficha as-built

`FichaAsBuilt` ganha `documentos`: os anexos da OP da unidade, com categoria Laudo de Teste ou Relatório de Inspeção. A tela de Rastreabilidade lista esses documentos com o link para abrir. A URL assinada é obtida por `/arquivos/:id/url`, que já confere a permissão da entidade.

### 5. Frontend

- Componente genérico `AnexosDoRegistro` (entidade, id, podeEditar, encerrado) com:
  - lista agrupada por categoria (título, arquivo, tamanho, data, quem enviou, validade);
  - abrir e baixar;
  - enviar (categoria, título, descrição, emissão e validade opcionais);
  - remover, que fica oculto quando o registro está encerrado;
  - versão nova de um documento (substitui, mantendo o histórico).
- Onde entra:
  - DetalheOP: seção "Documentos e laudos";
  - DetalhePedidoCompra: seção "Documentos";
  - DetalhePedidoVenda: seção "Documentos";
  - Fornecedores: ação "Documentos" na linha, abrindo um painel lateral ou modal;
  - Clientes: idem.
- DocumentosVencimentos: mostra também fornecedor e cliente, com o link para o cadastro.
- Rastreabilidade: bloco "Laudos e inspeções".

## Fora do escopo

- Antivírus e OCR.
- Assinatura digital de documentos.
- Envio de anexos por e-mail.
- Anexos em cotação (a cotação vira PC; a proposta vai no PC).

## Testes

- Backend:
  - categoria obrigatória e lista por entidade;
  - FOTO/DOCUMENTO recusados nas entidades novas;
  - remoção bloqueada em OP concluída, PC concluído e PV entregue;
  - vencimentos filtrados por permissão;
  - laudo na ficha as-built.
- Frontend: testes de unidade do componente e das telas.
- Playwright: anexar um laudo na OP, ver na ficha; documento de fornecedor com validade aparece nos vencimentos; remoção bloqueada após a conclusão.
