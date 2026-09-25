/**
 * Testes das regras de negócio do módulo (funções puras, sem interface).
 * Executar: npm test
 */
import { describe, expect, it } from 'vitest';
import { criarSeed } from '../data/seed';
import type { ClassificacaoDados, ContextoRisco, FerramentaIA, RegistroUso } from '../domain/types';
import { gerarAlertas } from '../services/alertEngine';
import { diff } from '../services/audit';
import { situacaoTreinamento } from '../services/derived';
import { aplicarFiltros, calcularIndicadores, FILTROS_VAZIOS } from '../services/metrics';
import { criarIndices } from '../services/derived';
import { podeDecidir, registrosVisiveis } from '../services/permissions';
import { calcularRisco, PESOS_PADRAO } from '../services/riskEngine';
import * as wf from '../services/workflow';
import { hoje } from '../utils/dates';

const semDados: ClassificacaoDados = { pessoal: false, sensivel: false, cliente: false, financeiro: false, contratual: false, estrategico: false };
const ctx: ContextoRisco = { impactoProcesso: 'BAIXO', grauAutomacao: 'ASSISTIDO', decisaoHumana: 'SEMPRE' };
const gemini: Pick<FerramentaIA, 'nome' | 'categoria' | 'exposicaoExterna'> = { nome: 'Gemini', categoria: 'HOMOLOGADA', exposicaoExterna: false };
const publica: Pick<FerramentaIA, 'nome' | 'categoria' | 'exposicaoExterna'> = { nome: 'IA pública', categoria: 'NAO_HOMOLOGADA', exposicaoExterna: true };

describe('motor de risco (transparente)', () => {
  it('uso simples em ferramenta homologada é Baixo e não exige aprovação', () => {
    const r = calcularRisco({ ferramenta: gemini, dados: semDados, contexto: ctx });
    expect(r.pontuacao).toBe(0);
    expect(r.nivelSugerido).toBe('BAIXO');
    expect(r.necessitaAprovacao).toBe(false);
  });

  it('a pontuação é exatamente a soma dos fatores exibidos', () => {
    const r = calcularRisco({ ferramenta: publica, dados: { ...semDados, financeiro: true, estrategico: true }, contexto: { ...ctx, impactoProcesso: 'ALTO' } });
    expect(r.pontuacao).toBe(r.fatores.reduce((s, f) => s + f.pontos, 0));
    expect(r.pontuacao).toBe(4 + 2 + 2 + 3 + 3); // 14 → faixa Alto (10–15)
    expect(r.nivelCalculado).toBe('ALTO');
  });

  it('regra de piso: dado sensível em ferramenta não homologada é sempre Crítico', () => {
    const r = calcularRisco({ ferramenta: { ...publica, exposicaoExterna: false }, dados: { ...semDados, sensivel: true }, contexto: ctx });
    expect(r.nivelCalculado).toBe('MEDIO'); // 4 + 4 = 8
    expect(r.nivelSugerido).toBe('CRITICO');
    expect(r.regrasAplicadas.length).toBe(1);
  });

  it('regra de piso: automação sem revisão humana é no mínimo Alto', () => {
    const r = calcularRisco({ ferramenta: gemini, dados: semDados, contexto: { impactoProcesso: 'BAIXO', grauAutomacao: 'AUTOMATIZADO', decisaoHumana: 'SEM_REVISAO' } });
    expect(r.nivelSugerido).toBe('ALTO');
  });

  it('dado de cliente exige aprovação mesmo em ferramenta homologada', () => {
    const r = calcularRisco({ ferramenta: gemini, dados: { ...semDados, cliente: true }, contexto: ctx });
    expect(r.necessitaAprovacao).toBe(true);
    expect(r.motivosAprovacao).toContain('Envolve dado de cliente');
  });

  it('respeita pesos configurados', () => {
    const pesos = { ...PESOS_PADRAO, dados: { ...PESOS_PADRAO.dados, financeiro: 10 } };
    const r = calcularRisco({ ferramenta: gemini, dados: { ...semDados, financeiro: true }, contexto: ctx }, pesos);
    expect(r.pontuacao).toBe(10);
    expect(r.nivelSugerido).toBe('ALTO');
  });
});

describe('fluxo de homologação', () => {
  const base = (necessita: boolean): RegistroUso => ({
    id: 'r1', codigo: 'IA-1', colaboradorId: 'u1', ferramentaId: 'f1', processo: 'p', atividade: 'a', finalidade: 'f', frequencia: 'Diária',
    dataInicio: '2026-01-01', responsavelProcessoId: 'u2', dados: semDados, descricaoDados: '', contexto: ctx,
    risco: { ...calcularRisco({ ferramenta: gemini, dados: semDados, contexto: ctx }), necessitaAprovacao: necessita },
    controleIds: [], observacoes: '', status: 'Em análise', criadoEm: '2026-01-01T00:00:00Z', criadoPorId: 'u1',
  });

  it('aprovação automática por política conclui até homologação', () => {
    const { aprovacao, status } = wf.criarFluxo(base(false), 'a1', 'u1', 'agora');
    expect(status).toBe('Aprovado');
    expect(aprovacao.automatica).toBe(true);
    expect(wf.etapaAtual(aprovacao)?.etapa).toBe('MONITORAMENTO');
  });

  it('percorre as 8 etapas na ordem e exige justificativa para reprovar', () => {
    let { aprovacao, status } = wf.criarFluxo(base(true), 'a1', 'u1', 't0');
    expect(status).toBe('Aguardando aprovação');
    expect(wf.etapaAtual(aprovacao)?.etapa).toBe('ANALISE');
    aprovacao = wf.avancarEtapa(aprovacao, 'u9', 't1', '');
    aprovacao = wf.avancarEtapa(aprovacao, 'u9', 't2', '');
    aprovacao = wf.avancarEtapa(aprovacao, 'u9', 't3', '');
    expect(wf.aguardandoDecisao(aprovacao)).toBe(true);
    expect(() => wf.avancarEtapa(aprovacao, 'u9', 't', '')).toThrow();
    expect(() => wf.decidir(aprovacao, 'Não aprovado', 'u9', 't4', '')).toThrow();
    const dec = wf.decidir(aprovacao, 'Aprovado com restrições', 'u9', 't4', 'Somente dados anonimizados');
    expect(dec.status).toBe('Aprovado com restrições');
    aprovacao = wf.homologar(dec.aprovacao, 'u9', 't5', '');
    expect(wf.etapaAtual(aprovacao)?.etapa).toBe('MONITORAMENTO');
    status = dec.status;
    expect(status).toBe('Aprovado com restrições');
  });

  it('reprovação encerra etapas seguintes como "Não aplicável"', () => {
    let { aprovacao } = wf.criarFluxo(base(true), 'a1', 'u1', 't0');
    for (let i = 0; i < 3; i++) aprovacao = wf.avancarEtapa(aprovacao, 'u9', 't', '');
    const r = wf.decidir(aprovacao, 'Não aprovado', 'u9', 't', 'Dados de clientes em IA pública');
    expect(r.status).toBe('Não aprovado');
    expect(r.aprovacao.etapas.filter(e => e.status === 'Não aplicável').map(e => e.etapa)).toEqual(['HOMOLOGACAO', 'MONITORAMENTO', 'REVISAO']);
  });
});

describe('permissões (RBAC)', () => {
  const db = criarSeed();
  const u = (id: string) => db.usuarios.find(x => x.id === id)!;

  it('colaborador vê apenas os próprios registros', () => {
    const visiveis = registrosVisiveis(db, u('usr-03'));
    expect(visiveis.length).toBeGreaterThan(0);
    expect(visiveis.every(r => r.colaboradorId === 'usr-03' || r.criadoPorId === 'usr-03')).toBe(true);
  });

  it('gestor vê apenas registros da sua área', () => {
    const ix = criarIndices(db);
    const visiveis = registrosVisiveis(db, u('usr-02'));
    expect(visiveis.every(r => ix.usuarios.get(r.colaboradorId)?.departamentoId === 'dep-mkt' || r.responsavelProcessoId === 'usr-02')).toBe(true);
  });

  it('gestor não aprova risco Alto; ninguém aprova a própria solicitação', () => {
    const alto = db.registrosUso.find(r => r.risco.nivelSugerido === 'CRITICO' || r.risco.nivelSugerido === 'ALTO')!;
    const gestor = db.usuarios.find(x => x.perfil === 'GESTOR' && x.departamentoId === db.usuarios.find(y => y.id === alto.colaboradorId)!.departamentoId);
    if (gestor && gestor.id !== alto.colaboradorId) expect(podeDecidir(db, gestor, alto).ok).toBe(false);
    const proprio = db.registrosUso.find(r => r.colaboradorId === 'usr-02')!;
    expect(podeDecidir(db, u('usr-02'), proprio).ok).toBe(false);
  });

  it('diretoria e auditor não decidem aprovações', () => {
    const r = db.registrosUso[0];
    expect(podeDecidir(db, u('usr-12'), r).ok).toBe(false);
    expect(podeDecidir(db, u('usr-13'), r).ok).toBe(false);
  });
});

describe('dados de demonstração, indicadores e alertas', () => {
  const db = criarSeed();
  const h = hoje();

  it('atende às quantidades mínimas da especificação', () => {
    expect(db.departamentos.length).toBeGreaterThanOrEqual(5);
    expect(db.usuarios.length).toBeGreaterThanOrEqual(10);
    expect(db.ferramentas.length).toBeGreaterThanOrEqual(5);
    expect(db.registrosUso.length).toBeGreaterThanOrEqual(15);
    expect(db.aprovacoes.filter(a => !a.automatica).length).toBeGreaterThanOrEqual(5);
    expect(db.riscos.length).toBeGreaterThanOrEqual(5);
    expect(db.incidentes.length).toBeGreaterThanOrEqual(3);
    expect(db.treinamentos.length).toBeGreaterThanOrEqual(5);
    expect(db.usuarios.every(u => u.email.endsWith('@exemplo.com.br'))).toBe(true);
  });

  it('não há aprovação feita pelo próprio solicitante nos dados de demonstração', () => {
    for (const a of db.aprovacoes) if (a.aprovadorId) expect(a.aprovadorId).not.toBe(a.solicitanteId);
  });

  it('gera os tipos de alerta esperados', () => {
    const chaves = gerarAlertas(db, h).map(a => a.chave.split(':')[0]);
    for (const k of ['ferramenta-nao-homologada', 'alto-risco-pendente', 'revisao-vencida', 'registro-sem-responsavel', 'caso-sem-responsavel', 'treinamento', 'politica', 'incidente', 'ferramenta-revisao'])
      expect(chaves).toContain(k);
  });

  it('alerta crítico quando uso autorizado tem dado sensível sem autorização', () => {
    const r = db.registrosUso.find(x => x.dados.sensivel && x.status === 'Aguardando aprovação')!;
    const alterado = { ...db, registrosUso: db.registrosUso.map(x => (x.id === r.id ? { ...x, status: 'Aprovado' as const } : x)) };
    const a = gerarAlertas(alterado, h).find(x => x.chave === `sensivel-sem-autorizacao:${r.id}`);
    expect(a?.nivel).toBe('CRITICO');
  });

  it('filtros globais recortam indicadores', () => {
    const ix = criarIndices(db);
    const todos = calcularIndicadores(db, db.registrosUso, db.incidentes, h);
    const mkt = aplicarFiltros(db.registrosUso, { ...FILTROS_VAZIOS, departamentoId: 'dep-mkt' }, ix);
    const ind = calcularIndicadores(db, mkt, [], h);
    expect(ind.totalRegistros).toBeLessThan(todos.totalRegistros);
    expect(mkt.every(r => ix.usuarios.get(r.colaboradorId)?.departamentoId === 'dep-mkt')).toBe(true);
  });

  it('situação de treinamento distingue treinado, pendente e vencido', () => {
    const u = (id: string) => db.usuarios.find(x => x.id === id)!;
    expect(situacaoTreinamento(db, u('usr-03'), h)).toBe('Treinado');
    expect(situacaoTreinamento(db, u('usr-10'), h)).toBe('Vencido');
    expect(situacaoTreinamento(db, u('usr-08'), h)).toBe('Pendente');
  });
});

describe('auditoria', () => {
  it('registra somente os campos alterados, com valor anterior e novo', () => {
    const d = diff({ id: '1', a: 1, b: 'x', c: [1] }, { id: '1', a: 2, b: 'x', c: [1, 2] });
    expect(d).toEqual([
      { campo: 'a', anterior: 1, novo: 2 },
      { campo: 'c', anterior: [1], novo: [1, 2] },
    ]);
  });
});
