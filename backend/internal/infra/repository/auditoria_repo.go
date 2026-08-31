package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gustavoflandal/pcp-lev/backend/internal/domain/auditoria"
	"github.com/gustavoflandal/pcp-lev/backend/internal/infra/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colunasAuditoria = `a.id, a.tabela, a.operacao, a.registro_id, a.dados_antigos,
	a.dados_novos, a.usuario_id, u.nome, a.data_hora, a.endereco_ip`

// colunasAuditoriaExportacao e colunasAuditoria sem dados_antigos/dados_novos:
// sao as duas colunas mais pesadas da tabela (a linha inteira serializada em
// JSONB, duas vezes por UPDATE) e o CSV de exportacao nao usa nenhuma das
// duas. Como a exportacao nao pagina, trazer os JSONB significaria transferir
// e desserializar a trilha inteira do filtro so para descarta-la.
const colunasAuditoriaExportacao = `a.id, a.tabela, a.operacao, a.registro_id,
	a.usuario_id, u.nome, a.data_hora, a.endereco_ip`

// camposSensiveisPorTabela lista, por tabela auditada, os campos que nunca
// podem sair da API. Os triggers da migration 007 gravam a linha inteira
// (to_jsonb(OLD/NEW)), entao todo login (que atualiza ultimo_login) e toda
// troca de senha deixam o hash bcrypt em dados_antigos/dados_novos; sem esta
// remocao, a tela de auditoria exibiria o hash de senha de qualquer usuario
// campo a campo. Mapa, e nao um caso especial embutido, porque outras
// tabelas podem ganhar campos sensiveis depois.
var camposSensiveisPorTabela = map[string][]string{
	"usuarios": {"senha_hash"},
}

// fusoDeGravacao e o fuso em que auditoria.data_hora (TIMESTAMP sem timezone,
// DEFAULT CURRENT_TIMESTAMP) e gravado: o container do Postgres roda com
// TZ=America/Sao_Paulo (docker-compose.yml), entao o valor armazenado e a
// hora de parede de Sao Paulo. Offset fixo de -03:00 porque o Brasil nao
// observa horario de verao desde 2019 -- se isso voltar a mudar, este e o
// ponto a revisitar (e time.LoadLocation passaria a exigir tzdata na imagem).
var fusoDeGravacao = time.FixedZone("America/Sao_Paulo", -3*60*60)

// AuditoriaRepositorio implementa auditoria.Repositorio sobre PostgreSQL.
type AuditoriaRepositorio struct {
	pool *pgxpool.Pool
}

// NovoAuditoriaRepositorio cria o repositorio de auditoria.
func NovoAuditoriaRepositorio(pool *pgxpool.Pool) *AuditoriaRepositorio {
	return &AuditoriaRepositorio{pool: pool}
}

// Listar devolve a pagina de registros (mais recentes primeiro) e o total
// que bate nos filtros, para a paginacao do frontend.
func (r *AuditoriaRepositorio) Listar(ctx context.Context, filtros auditoria.Filtros) ([]auditoria.Registro, int, error) {
	condicoes, argumentos := condicoesDeAuditoria(filtros)
	executor := db.DoContexto(ctx, r.pool)

	var total int
	if err := executor.QueryRow(ctx,
		`SELECT count(*) FROM auditoria a `+condicoes, argumentos...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar auditoria: %w", err)
	}

	sql := fmt.Sprintf(
		`SELECT %s FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id %s
		 ORDER BY a.data_hora DESC LIMIT $%d OFFSET $%d`,
		colunasAuditoria, condicoes, len(argumentos)+1, len(argumentos)+2)
	argumentos = append(argumentos, filtros.Limite, filtros.Offset())

	linhas, err := executor.Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, 0, fmt.Errorf("listar auditoria: %w", err)
	}
	defer linhas.Close()

	itens, err := lerRegistros(linhas)
	if err != nil {
		return nil, 0, err
	}
	return itens, total, nil
}

// ListarParaExportar e como Listar, mas sem paginacao -- para o CSV, que
// precisa de todas as linhas que batem no filtro, nao so de uma pagina.
func (r *AuditoriaRepositorio) ListarParaExportar(ctx context.Context, filtros auditoria.Filtros) ([]auditoria.Registro, error) {
	condicoes, argumentos := condicoesDeAuditoria(filtros)

	sql := fmt.Sprintf(
		`SELECT %s FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id %s
		 ORDER BY a.data_hora DESC`,
		colunasAuditoriaExportacao, condicoes)

	linhas, err := db.DoContexto(ctx, r.pool).Query(ctx, sql, argumentos...)
	if err != nil {
		return nil, fmt.Errorf("exportar auditoria: %w", err)
	}
	defer linhas.Close()

	return lerRegistrosParaExportar(linhas)
}

// condicoesDeAuditoria monta o WHERE condicional dos filtros de periodo,
// usuario, tabela e operacao -- mesmo padrao de filtrosDeCadastro, mas com
// um formato de filtro proprio (nao e "ativo"/"busca").
func condicoesDeAuditoria(filtros auditoria.Filtros) (string, []any) {
	condicoes := make([]string, 0, 4)
	argumentos := make([]any, 0, 4)

	if filtros.DataInicio != nil {
		argumentos = append(argumentos, *filtros.DataInicio)
		condicoes = append(condicoes, fmt.Sprintf("a.data_hora >= $%d", len(argumentos)))
	}
	if filtros.DataFim != nil {
		argumentos = append(argumentos, *filtros.DataFim)
		condicoes = append(condicoes, fmt.Sprintf("a.data_hora <= $%d", len(argumentos)))
	}
	if filtros.UsuarioID != nil {
		argumentos = append(argumentos, *filtros.UsuarioID)
		condicoes = append(condicoes, fmt.Sprintf("a.usuario_id = $%d", len(argumentos)))
	}
	if filtros.Tabela != "" {
		argumentos = append(argumentos, filtros.Tabela)
		condicoes = append(condicoes, fmt.Sprintf("a.tabela = $%d", len(argumentos)))
	}
	if filtros.Operacao != "" {
		argumentos = append(argumentos, filtros.Operacao)
		condicoes = append(condicoes, fmt.Sprintf("a.operacao = $%d", len(argumentos)))
	}

	if len(condicoes) == 0 {
		return "", argumentos
	}
	return "WHERE " + strings.Join(condicoes, " AND "), argumentos
}

// lerRegistros le as linhas de colunasAuditoria (consulta com paginacao,
// que alimenta a tela e a modal de diff).
func lerRegistros(linhas pgx.Rows) ([]auditoria.Registro, error) {
	return lerLinhasDeAuditoria(linhas, func(linhas pgx.Rows, reg *auditoria.Registro) error {
		return linhas.Scan(
			&reg.ID, &reg.Tabela, &reg.Operacao, &reg.RegistroID, &reg.DadosAntigos,
			&reg.DadosNovos, &reg.UsuarioID, &reg.UsuarioNome, &reg.DataHora, &reg.EnderecoIP,
		)
	})
}

// lerRegistrosParaExportar le as linhas de colunasAuditoriaExportacao.
// DadosAntigos/DadosNovos ficam no zero-value de proposito -- nao sao
// consultados no banco e o CSV do handler nao os usa.
func lerRegistrosParaExportar(linhas pgx.Rows) ([]auditoria.Registro, error) {
	return lerLinhasDeAuditoria(linhas, func(linhas pgx.Rows, reg *auditoria.Registro) error {
		return linhas.Scan(
			&reg.ID, &reg.Tabela, &reg.Operacao, &reg.RegistroID,
			&reg.UsuarioID, &reg.UsuarioNome, &reg.DataHora, &reg.EnderecoIP,
		)
	})
}

// lerLinhasDeAuditoria percorre o cursor com o scan que a consulta pede e
// aplica o pos-processamento comum as duas (fuso e campos sensiveis), para
// que exportacao e listagem nunca divirjam nesses dois pontos.
func lerLinhasDeAuditoria(
	linhas pgx.Rows,
	escanear func(pgx.Rows, *auditoria.Registro) error,
) ([]auditoria.Registro, error) {
	itens := make([]auditoria.Registro, 0)
	for linhas.Next() {
		var reg auditoria.Registro
		if err := escanear(linhas, &reg); err != nil {
			return nil, fmt.Errorf("ler registro de auditoria: %w", err)
		}
		normalizarRegistro(&reg)
		itens = append(itens, reg)
	}
	return itens, linhas.Err()
}

// normalizarRegistro ajusta o que sai do banco antes de chegar a API:
// reetiqueta o horario no fuso em que foi gravado e remove os campos
// sensiveis do payload JSONB.
func normalizarRegistro(reg *auditoria.Registro) {
	// Reetiquetagem, nao conversao: o pgx devolve o TIMESTAMP sem timezone
	// como time.Time em UTC, o que faria o JSON sair "...T10:00:00Z" para um
	// evento que aconteceu as 10:00 em Sao Paulo -- e o navegador, lendo esse
	// ISO como UTC de verdade, exibiria 07:00. Mantendo os mesmos digitos de
	// hora de parede em fusoDeGravacao, o JSON sai "...T10:00:00-03:00"
	// (instante absoluto correto) e o Format("2006-01-02 15:04:05") do CSV
	// continua imprimindo exatamente os mesmos digitos de antes.
	reg.DataHora = time.Date(
		reg.DataHora.Year(), reg.DataHora.Month(), reg.DataHora.Day(),
		reg.DataHora.Hour(), reg.DataHora.Minute(), reg.DataHora.Second(),
		reg.DataHora.Nanosecond(), fusoDeGravacao,
	)

	campos, temSensiveis := camposSensiveisPorTabela[reg.Tabela]
	if !temSensiveis {
		return
	}
	reg.DadosAntigos = semCamposSensiveis(reg.DadosAntigos, campos)
	reg.DadosNovos = semCamposSensiveis(reg.DadosNovos, campos)
}

// semCamposSensiveis devolve o JSONB sem as chaves informadas. Um payload
// ausente (NULL no banco: INSERT nao tem dados_antigos, DELETE nao tem
// dados_novos) ou sem nenhuma das chaves passa intacto, sem custo de
// remarshal.
func semCamposSensiveis(dados json.RawMessage, campos []string) json.RawMessage {
	if len(dados) == 0 {
		return dados
	}

	var objeto map[string]json.RawMessage
	if err := json.Unmarshal(dados, &objeto); err != nil {
		// to_jsonb(OLD/NEW) sempre produz um objeto, entao isto nao deve
		// acontecer; se acontecer, descartar o payload e a saida segura --
		// nao da para garantir que o campo sensivel nao esta la dentro.
		return nil
	}

	removeu := false
	for _, campo := range campos {
		if _, existe := objeto[campo]; existe {
			delete(objeto, campo)
			removeu = true
		}
	}
	if !removeu {
		return dados
	}

	limpo, err := json.Marshal(objeto)
	if err != nil {
		return nil
	}
	return limpo
}
