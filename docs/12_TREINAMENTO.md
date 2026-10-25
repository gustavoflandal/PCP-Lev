# Treinamento por perfil

**Para:** o Gestor de Operações, que conduz o treinamento, e as pessoas de cada área.
**Material base:** o [manual de operação](8_MANUAL_OPERACAO.md). Cada trilha indica as seções a ler, na ordem, e os exercícios práticos.
**Onde praticar:** no ambiente de homologação, nunca no de produção. Os exercícios usam os mesmos fluxos do [roteiro de homologação](11_ROTEIRO_HOMOLOGACAO.md), então treinar e homologar podem acontecer juntos.

## Para todos (30 min)

Leitura: manual 1 a 3, 12, 29 e 30.

- [ ] Entrar, trocar a senha temporária e sair.
- [ ] Mudar tema, contraste e tamanho da fonte em Preferências.
- [ ] Abrir a **Ajuda** (canto superior direito) em duas telas diferentes.
- [ ] Saber o que fazer com as mensagens:
  - **"Sessão expirada"** ou **"Sua sessão foi encerrada"**: entrar de novo.
  - **"Muitas tentativas"**: aguardar alguns minutos ou pedir ao administrador que redefina a senha.

## Almoxarife (2 h)

Leitura: manual 10, 26, 27 e 28.2.

1. **Recebimento por XML:** importar a nota, vincular os itens novos ao cadastro, contar a mercadoria, conferir e efetivar.
2. **Recebimento manual:** lançar uma nota em papel com lote e validade, e outra com números de série (usar o leitor de código de barras).
3. **Pendências:** provocar e resolver cada tipo — séries faltando, lote somando menos, validade curta, preço fora do pedido.
4. **Estorno:** estornar uma nota lançada errada. Entender por que uma nota já usada pela produção não pode ser estornada.
5. **Consultas:** kardex de uma peça, origem do saldo e lotes a vencer.
6. **Ajuste de inventário:** registrar uma diferença de contagem com motivo, lote e validade.

## Comprador (1 h 30)

Leitura: manual 4, 8, 9, 11, 17 (parte de compras) e 28.2.

1. Cadastrar um fornecedor e anexar o certificado de qualidade com validade.
2. Cadastrar o de-para dos códigos do fornecedor.
3. Cotação até pedido de compra, incluindo a regra de cotações mínimas e a alçada do Gestor.
4. Acompanhar pedidos em atraso e encerrar um pedido com saldo que não será entregue.
5. Usar a Necessidade de compra e exportar o CSV.

## Operador de montagem (45 min)

Leitura: manual 24 (Kanban e apontamento).

1. Achar a OP no Kanban e abrir o detalhe.
2. Iniciar e encerrar o apontamento no próprio centro de trabalho.
3. Saber quando a OP não avança (apontamento aberto, unidade sem teste) e a quem avisar.

## Qualidade (1 h)

Leitura: manual 24 (testes), 25, 27 e 28.

1. Registrar o teste de cada unidade (aprovado ou reprovado, com resultado).
2. Registrar a metrologia das unidades que exigem.
3. Anexar o laudo de teste e o relatório de inspeção na OP.
4. Rastrear uma unidade pelo QR Code e um lote "do lote ao campo".
5. Acompanhar metrologia e documentos a vencer.

## Vendas (45 min)

Leitura: manual 21, 23 e 28.2.

1. Cadastrar um cliente e anexar o contrato.
2. Criar um pedido de venda e acompanhar a produção das unidades.
3. Registrar a entrega e anexar o termo de aceite.

## Gestor de Operações (2 h)

Leitura: todas as trilhas acima, mais manual 7, 13 a 22.

1. Montar e versionar a estrutura (BOM) de um produto.
2. Gerar e liberar OPs e ler a lista de faltas quando não há material.
3. Aprovar uma divergência de preço numa nota.
4. Ler o custo real de uma OP concluída.
5. Consultar a Auditoria.
6. Revisar perfis e permissões com o administrador.

## Administrador do sistema (1 h, com a TI)

Leitura: manual 13 a 20, mais [docs/9_SEGURANCA.md](9_SEGURANCA.md) e [docs/10_IMPLANTACAO.md](10_IMPLANTACAO.md).

1. Criar usuários, redefinir a senha de uma conta bloqueada e inativar uma conta.
2. Ajustar a matriz de perfis e dar uma permissão individual.
3. Configurar o SMTP e enviar o e-mail de teste.
4. Fazer um backup imediato e acompanhar o backup diário.
5. Ensaiar a restauração numa máquina de teste.

## Registro

| Pessoa | Perfil | Trilha concluída em | Instrutor |
|---|---|---|---|
| | | | |
