/**
 * Estado global do módulo de Governança e Segurança da IA.
 *
 * PONTO CRÍTICO: toda gravação passa por `commit()`, que garante, nesta ordem:
 *   1. verificação de permissão (quem chama valida antes com `exigir`);
 *   2. aplicação da regra de negócio (motores em /services);
 *   3. geração da trilha de auditoria;
 *   4. persistência via GovernanceRepository;
 *   5. publicação de eventos de domínio (automações futuras).
 * Nenhuma tela deve alterar o banco por outro caminho.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ETAPA_LABEL, STATUS_AUTORIZADOS } from '../domain/catalogs';
import type {
  Alerta,
  Aprovacao,
  Entidade,
  EventoAuditoria,
  FiltrosGlobais,
  GovernanceDB,
  ID,
  Incidente,
  NivelRisco,
  PaginaId,
  RegistroUso,
  StatusUso,
  Usuario,
} from '../domain/types';
import { criarRepositorio } from '../data/repository';
import { gerarAlertas } from '../services/alertEngine';
import { criarEvento, diff } from '../services/audit';
import { automacao, EventoDominio, TipoEvento } from '../services/automation';
import { criarIndices, Indices } from '../services/derived';
import { aplicarFiltros, aplicarFiltrosIncidentes, FILTROS_VAZIOS } from '../services/metrics';
import { escopoDe, pode, podeDecidir, Permissao, registrosVisiveis, usuariosVisiveis } from '../services/permissions';
import { calcularRisco } from '../services/riskEngine';
import * as wf from '../services/workflow';
import { agora, hoje as hojeFn, novoId } from '../utils/dates';

/** Coleções editáveis de forma genérica (cadastros). */
type ColecaoCadastro =
  | 'empresas' | 'departamentos' | 'usuarios' | 'ferramentas' | 'casosUso' | 'riscos' | 'controles'
  | 'treinamentos' | 'participacoes' | 'incidentes' | 'politicas' | 'melhorias';

type ItemDe<C extends ColecaoCadastro> = GovernanceDB[C][number];

export interface AlertaComEstado extends Alerta { reconhecido: boolean }

export type NovoRegistro = Omit<RegistroUso,
  'id' | 'codigo' | 'risco' | 'aprovacaoId' | 'status' | 'criadoEm' | 'criadoPorId' | 'ultimaRevisao' | 'proximaRevisao'>;

interface Toast { id: number; tipo: 'sucesso' | 'erro' | 'info'; texto: string }

interface Navegacao { pagina: PaginaId; registroId?: ID }

interface GovernanceState {
  db: GovernanceDB;
  ix: Indices;
  hoje: string;
  usuario: Usuario;
  trocarUsuario: (id: ID) => void;
  pode: (p: Permissao) => boolean;

  // Recortes por escopo do perfil
  registros: RegistroUso[];
  usuariosEscopo: Usuario[];
  incidentesEscopo: Incidente[];

  // Filtros globais
  filtros: FiltrosGlobais;
  setFiltros: (f: FiltrosGlobais) => void;
  registrosFiltrados: RegistroUso[];
  incidentesFiltrados: Incidente[];

  alertas: AlertaComEstado[];

  // Navegação interna do módulo
  nav: Navegacao;
  navegar: (pagina: PaginaId, registroId?: ID) => void;

  // Ações
  submeterRegistro: (dados: NovoRegistro) => RegistroUso;
  atualizarRegistro: (id: ID, patch: Partial<NovoRegistro>) => void;
  ajustarRisco: (id: ID, nivel: NivelRisco, justificativa: string) => void;
  alterarStatusRegistro: (id: ID, status: StatusUso, observacao: string) => void;
  avancarEtapa: (aprovacaoId: ID, observacao: string) => void;
  decidir: (aprovacaoId: ID, decisao: wf.Decisao, justificativa: string) => void;
  homologar: (aprovacaoId: ID, observacao: string) => void;
  registrarRevisao: (registroId: ID, observacao: string) => void;
  salvar: <C extends ColecaoCadastro>(colecao: C, item: ItemDe<C>, entidade: Entidade, rotulo: string, permissao: Permissao) => void;
  excluir: <C extends ColecaoCadastro>(colecao: C, id: ID, entidade: Entidade, rotulo: string, permissao: Permissao) => void;
  salvarConfiguracoes: (c: GovernanceDB['configuracoes']) => void;
  reconhecerAlerta: (chave: string) => void;
  restaurarDemonstracao: () => void;

  toasts: Toast[];
  notificar: (texto: string, tipo?: Toast['tipo']) => void;
}

const Ctx = createContext<GovernanceState | null>(null);

export const useGovernanca = (): GovernanceState => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGovernanca deve ser usado dentro de <GovernanceProvider>');
  return c;
};

const CHAVE_USUARIO = 'cicllos_aigov_usuario';

export const GovernanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const repo = useMemo(() => criarRepositorio(), []);
  const [db, setDb] = useState<GovernanceDB>(() => repo.carregar());
  // Ref com o estado mais recente: permite ações síncronas sem efeitos colaterais dentro de setState.
  const dbRef = useRef(db);

  const [usuarioId, setUsuarioId] = useState<ID>(() => localStorage.getItem(CHAVE_USUARIO) || 'usr-01');
  const usuario = db.usuarios.find(u => u.id === usuarioId) ?? db.usuarios[0];

  const [filtros, setFiltros] = useState<FiltrosGlobais>(FILTROS_VAZIOS);
  const [nav, setNav] = useState<Navegacao>({ pagina: usuario.perfil === 'COLABORADOR' ? 'governanca' : 'visao-geral' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const hoje = hojeFn();

  const notificar = useCallback((texto: string, tipo: Toast['tipo'] = 'sucesso') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, tipo, texto }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  /** Gravação única: aplica, audita, persiste e publica. */
  const commit = useCallback(
    (novo: GovernanceDB, auditoria: EventoAuditoria[], eventos: Omit<EventoDominio, 'quando' | 'usuarioId'>[]) => {
      const final = { ...novo, auditoria: [...auditoria, ...novo.auditoria] };
      dbRef.current = final;
      setDb(final);
      repo.salvar(final);
      const quando = agora();
      for (const ev of eventos) automacao.publicar({ ...ev, quando, usuarioId: usuario.id });
    },
    [repo, usuario.id],
  );

  const exigir = useCallback(
    (p: Permissao) => {
      if (!pode(usuario, p)) throw new Error('Seu perfil não possui permissão para esta ação.');
    },
    [usuario],
  );

  const deptoDe = (d: GovernanceDB, colaboradorId: ID) => d.usuarios.find(u => u.id === colaboradorId)?.departamentoId;
  const rotuloRegistro = (r: RegistroUso) => `${r.codigo} — ${r.atividade}`;

  // ------------------------------------------------------------ Registro de uso
  const submeterRegistro = useCallback((dados: NovoRegistro): RegistroUso => {
    exigir('uso.registrar');
    const d = dbRef.current;
    // Colaborador só registra uso próprio.
    if (escopoDe(usuario) === 'PROPRIO' && dados.colaboradorId !== usuario.id) throw new Error('Você só pode registrar utilizações próprias.');
    const ferramenta = d.ferramentas.find(f => f.id === dados.ferramentaId);
    if (!ferramenta) throw new Error('Ferramenta inválida.');
    const seq = d.registrosUso.reduce((m, r) => Math.max(m, Number(r.codigo.replace(/\D/g, '')) || 0), 0) + 1;
    const quando = agora();
    const registro: RegistroUso = {
      ...dados,
      id: novoId('uso'),
      codigo: `IA-${String(seq).padStart(4, '0')}`,
      risco: calcularRisco({ ferramenta, dados: dados.dados, contexto: dados.contexto }, d.configuracoes.pesosRisco),
      status: 'Em análise',
      criadoEm: quando,
      criadoPorId: usuario.id,
    };
    const fluxo = wf.criarFluxo(registro, novoId('apr'), usuario.id, quando);
    registro.status = fluxo.status;
    registro.aprovacaoId = fluxo.aprovacao.id;
    if (fluxo.aprovacao.automatica) {
      registro.ultimaRevisao = hoje;
      registro.proximaRevisao = wf.proximaRevisaoRegistro(registro, hoje, d.configuracoes.periodicidadeRevisaoMeses);
    }
    const audit = [
      criarEvento({
        usuarioId: usuario.id, entidade: 'Registro de uso', registroId: registro.id, registroRotulo: rotuloRegistro(registro),
        acao: 'SUBMISSÃO', alteracoes: diff(undefined, registro), departamentoId: deptoDe(d, registro.colaboradorId),
      }),
    ];
    commit(
      { ...d, registrosUso: [registro, ...d.registrosUso], aprovacoes: [fluxo.aprovacao, ...d.aprovacoes] },
      audit,
      [{ tipo: 'uso.submetido', registroId: registro.id, dados: { status: registro.status, nivel: registro.risco.nivelSugerido } }],
    );
    return registro;
  }, [commit, exigir, hoje, usuario]);

  const atualizarRegistro = useCallback((id: ID, patch: Partial<NovoRegistro>) => {
    const d = dbRef.current;
    const antes = d.registrosUso.find(r => r.id === id);
    if (!antes) return;
    const proprio = antes.colaboradorId === usuario.id || antes.criadoPorId === usuario.id;
    if (!pode(usuario, 'uso.editar') && !proprio) throw new Error('Sem permissão para editar este registro.');
    const depois: RegistroUso = { ...antes, ...patch };
    // Mudou algo que afeta o risco? Recalcula de forma transparente.
    const ferramenta = d.ferramentas.find(f => f.id === depois.ferramentaId)!;
    depois.risco = calcularRisco({ ferramenta, dados: depois.dados, contexto: depois.contexto }, d.configuracoes.pesosRisco);
    const alteracoes = diff(antes, depois);
    if (antes.risco.nivelSugerido !== depois.risco.nivelSugerido)
      alteracoes.push({ campo: 'nível de risco sugerido', anterior: antes.risco.nivelSugerido, novo: depois.risco.nivelSugerido });
    if (!alteracoes.length) return;
    commit(
      { ...d, registrosUso: d.registrosUso.map(r => (r.id === id ? depois : r)) },
      [criarEvento({ usuarioId: usuario.id, entidade: 'Registro de uso', registroId: id, registroRotulo: rotuloRegistro(depois), acao: 'ALTERAÇÃO', alteracoes, departamentoId: deptoDe(d, depois.colaboradorId) })],
      [{ tipo: 'uso.atualizado', registroId: id }],
    );
  }, [commit, usuario]);

  const ajustarRisco = useCallback((id: ID, nivel: NivelRisco, justificativa: string) => {
    exigir('aprovacao.decidir');
    if (!justificativa.trim()) throw new Error('Justificativa obrigatória para ajustar o risco.');
    const d = dbRef.current;
    const antes = d.registrosUso.find(r => r.id === id)!;
    const depois: RegistroUso = { ...antes, ajusteRisco: { nivel, justificativa, responsavelId: usuario.id, data: agora() } };
    commit(
      { ...d, registrosUso: d.registrosUso.map(r => (r.id === id ? depois : r)) },
      [criarEvento({
        usuarioId: usuario.id, entidade: 'Registro de uso', registroId: id, registroRotulo: rotuloRegistro(antes), acao: 'AJUSTE DE RISCO',
        alteracoes: [{ campo: 'nível de risco', anterior: antes.ajusteRisco?.nivel ?? antes.risco.nivelSugerido, novo: nivel }, { campo: 'justificativa', anterior: undefined, novo: justificativa }],
        departamentoId: deptoDe(d, antes.colaboradorId),
      })],
      [{ tipo: 'risco.ajustado', registroId: id, dados: { nivel } }],
    );
  }, [commit, exigir, usuario.id]);

  const alterarStatusRegistro = useCallback((id: ID, status: StatusUso, observacao: string) => {
    exigir('aprovacao.decidir');
    const d = dbRef.current;
    const antes = d.registrosUso.find(r => r.id === id)!;
    if (antes.status === status) return;
    const depois = { ...antes, status, observacoes: observacao ? `${antes.observacoes ? antes.observacoes + '\n' : ''}[${hoje}] ${observacao}` : antes.observacoes };
    commit(
      { ...d, registrosUso: d.registrosUso.map(r => (r.id === id ? depois : r)) },
      [criarEvento({ usuarioId: usuario.id, entidade: 'Registro de uso', registroId: id, registroRotulo: rotuloRegistro(antes), acao: 'ALTERAÇÃO', alteracoes: diff(antes, depois), departamentoId: deptoDe(d, antes.colaboradorId) })],
      [{ tipo: 'uso.atualizado', registroId: id, dados: { status } }],
    );
  }, [commit, exigir, hoje, usuario.id]);

  // -------------------------------------------------------------- Fluxo
  const operarFluxo = useCallback(
    (aprovacaoId: ID, tipo: TipoEvento, acao: EventoAuditoria['acao'], op: (a: Aprovacao, r: RegistroUso) => { aprovacao: Aprovacao; registro: RegistroUso }) => {
      const d = dbRef.current;
      const a = d.aprovacoes.find(x => x.id === aprovacaoId);
      const r = a && d.registrosUso.find(x => x.id === a.registroUsoId);
      if (!a || !r) throw new Error('Fluxo não encontrado.');
      const perm = podeDecidir(d, usuario, r);
      if (!perm.ok) throw new Error(perm.motivo);
      const res = op(a, r);
      const etapaAntes = wf.etapaAtual(a)?.etapa;
      const etapaDepois = wf.etapaAtual(res.aprovacao)?.etapa;
      const alteracoes = [
        ...(etapaAntes !== etapaDepois ? [{ campo: 'etapa', anterior: etapaAntes && ETAPA_LABEL[etapaAntes], novo: etapaDepois && ETAPA_LABEL[etapaDepois] }] : []),
        ...diff({ status: r.status, proximaRevisao: r.proximaRevisao }, { status: res.registro.status, proximaRevisao: res.registro.proximaRevisao }),
      ];
      commit(
        {
          ...d,
          aprovacoes: d.aprovacoes.map(x => (x.id === aprovacaoId ? res.aprovacao : x)),
          registrosUso: d.registrosUso.map(x => (x.id === r.id ? res.registro : x)),
        },
        [criarEvento({ usuarioId: usuario.id, entidade: 'Aprovação', registroId: a.id, registroRotulo: rotuloRegistro(r), acao, alteracoes, departamentoId: deptoDe(d, r.colaboradorId) })],
        [{ tipo, registroId: r.id, dados: { etapa: etapaDepois, status: res.registro.status } }],
      );
    },
    [commit, usuario],
  );

  const avancarEtapa = useCallback((id: ID, obs: string) =>
    operarFluxo(id, 'aprovacao.etapa_avancada', 'AVANÇO DE ETAPA', (a, r) => ({ aprovacao: wf.avancarEtapa(a, usuario.id, agora(), obs), registro: r.status === 'Em análise' ? { ...r, status: 'Aguardando aprovação' } : r })),
  [operarFluxo, usuario.id]);

  const decidir = useCallback((id: ID, decisao: wf.Decisao, just: string) =>
    operarFluxo(id, 'aprovacao.decidida', decisao === 'Não aprovado' ? 'REPROVAÇÃO' : 'APROVAÇÃO', (a, r) => {
      const res = wf.decidir(a, decisao, usuario.id, agora(), just);
      return { aprovacao: res.aprovacao, registro: { ...r, status: res.status } };
    }),
  [operarFluxo, usuario.id]);

  const homologar = useCallback((id: ID, obs: string) =>
    operarFluxo(id, 'aprovacao.homologada', 'AVANÇO DE ETAPA', (a, r) => ({
      aprovacao: wf.homologar(a, usuario.id, agora(), obs),
      registro: { ...r, ultimaRevisao: hoje, proximaRevisao: wf.proximaRevisaoRegistro(r, hoje, dbRef.current.configuracoes.periodicidadeRevisaoMeses) },
    })),
  [operarFluxo, usuario.id, hoje]);

  const registrarRevisao = useCallback((registroId: ID, obs: string) => {
    const r = dbRef.current.registrosUso.find(x => x.id === registroId);
    if (!r?.aprovacaoId) throw new Error('Registro sem fluxo de homologação.');
    if (!STATUS_AUTORIZADOS.includes(r.status)) throw new Error('Só é possível revisar utilizações autorizadas.');
    operarFluxo(r.aprovacaoId, 'uso.revisado', 'ALTERAÇÃO', (a, reg) => ({
      aprovacao: wf.registrarRevisao(a, usuario.id, agora(), obs),
      registro: { ...reg, ultimaRevisao: hoje, proximaRevisao: wf.proximaRevisaoRegistro(reg, hoje, dbRef.current.configuracoes.periodicidadeRevisaoMeses) },
    }));
  }, [operarFluxo, usuario.id, hoje]);

  // ------------------------------------------------------------ Cadastros genéricos
  const salvar = useCallback(<C extends ColecaoCadastro>(colecao: C, item: ItemDe<C>, entidade: Entidade, rotulo: string, permissao: Permissao) => {
    exigir(permissao);
    const d = dbRef.current;
    const lista = d[colecao] as ItemDe<C>[];
    const antes = lista.find(x => x.id === item.id);
    const alteracoes = diff(antes as object | undefined, item as object);
    if (antes && !alteracoes.length) return;
    const novaLista = antes ? lista.map(x => (x.id === item.id ? item : x)) : [item, ...lista];
    const depto = 'departamentoId' in item ? (item as { departamentoId?: ID }).departamentoId : undefined;
    commit(
      { ...d, [colecao]: novaLista } as GovernanceDB,
      [criarEvento({ usuarioId: usuario.id, entidade, registroId: item.id, registroRotulo: rotulo, acao: antes ? 'ALTERAÇÃO' : 'CRIAÇÃO', alteracoes, departamentoId: depto })],
      [{ tipo: colecao === 'incidentes' ? (antes ? 'incidente.atualizado' : 'incidente.registrado') : colecao === 'ferramentas' ? 'ferramenta.atualizada' : colecao === 'politicas' ? 'politica.versionada' : colecao === 'participacoes' || colecao === 'treinamentos' ? 'treinamento.atualizado' : 'cadastro.atualizado', registroId: item.id }],
    );
  }, [commit, exigir, usuario.id]);

  const excluir = useCallback(<C extends ColecaoCadastro>(colecao: C, id: ID, entidade: Entidade, rotulo: string, permissao: Permissao) => {
    exigir(permissao);
    const d = dbRef.current;
    const lista = d[colecao] as ItemDe<C>[];
    const antes = lista.find(x => x.id === id);
    if (!antes) return;
    commit(
      { ...d, [colecao]: lista.filter(x => x.id !== id) } as GovernanceDB,
      [criarEvento({ usuarioId: usuario.id, entidade, registroId: id, registroRotulo: rotulo, acao: 'EXCLUSÃO', alteracoes: diff(antes as object, undefined) })],
      [{ tipo: 'cadastro.atualizado', registroId: id }],
    );
  }, [commit, exigir, usuario.id]);

  const salvarConfiguracoes = useCallback((c: GovernanceDB['configuracoes']) => {
    exigir('configuracoes.gerenciar');
    const d = dbRef.current;
    commit(
      { ...d, configuracoes: c },
      [criarEvento({ usuarioId: usuario.id, entidade: 'Configuração', registroId: 'configuracoes', registroRotulo: 'Configurações do módulo', acao: 'ALTERAÇÃO', alteracoes: diff(d.configuracoes, c) })],
      [{ tipo: 'cadastro.atualizado', registroId: 'configuracoes' }],
    );
  }, [commit, exigir, usuario.id]);

  const reconhecerAlerta = useCallback((chave: string) => {
    exigir('alerta.reconhecer');
    const d = dbRef.current;
    if (d.alertasEstado.some(a => a.chave === chave)) return;
    commit(
      { ...d, alertasEstado: [...d.alertasEstado, { chave, reconhecidoPorId: usuario.id, reconhecidoEm: agora() }] },
      [criarEvento({ usuarioId: usuario.id, entidade: 'Alerta', registroId: chave, registroRotulo: chave, acao: 'RECONHECIMENTO' })],
      [{ tipo: 'alerta.reconhecido', registroId: chave }],
    );
  }, [commit, exigir, usuario.id]);

  const restaurarDemonstracao = useCallback(() => {
    exigir('configuracoes.gerenciar');
    const seed = repo.restaurarDemonstracao();
    dbRef.current = seed;
    setDb(seed);
    notificar('Dados de demonstração restaurados.', 'info');
  }, [exigir, notificar, repo]);

  const trocarUsuario = useCallback((id: ID) => {
    setUsuarioId(id);
    localStorage.setItem(CHAVE_USUARIO, id);
    const u = dbRef.current.usuarios.find(x => x.id === id);
    setFiltros(FILTROS_VAZIOS);
    setNav({ pagina: u?.perfil === 'COLABORADOR' ? 'governanca' : 'visao-geral' });
  }, []);

  // ------------------------------------------------------------ Derivados
  const ix = useMemo(() => criarIndices(db), [db]);
  const registros = useMemo(() => registrosVisiveis(db, usuario), [db, usuario]);
  const usuariosEscopo = useMemo(() => usuariosVisiveis(db, usuario), [db, usuario]);
  const incidentesEscopo = useMemo(() => {
    const escopo = escopoDe(usuario);
    if (escopo === 'TUDO') return db.incidentes;
    const ids = new Set(usuariosEscopo.map(u => u.id));
    return db.incidentes.filter(i => (i.colaboradorId ? ids.has(i.colaboradorId) : escopo === 'DEPARTAMENTO' && i.departamentoId === usuario.departamentoId));
  }, [db, usuario, usuariosEscopo]);

  const registrosFiltrados = useMemo(() => aplicarFiltros(registros, filtros, ix), [registros, filtros, ix]);
  const incidentesFiltrados = useMemo(() => aplicarFiltrosIncidentes(incidentesEscopo, filtros, ix), [incidentesEscopo, filtros, ix]);

  const alertas = useMemo<AlertaComEstado[]>(() => {
    const reconhecidos = new Set(db.alertasEstado.map(a => a.chave));
    const escopo = escopoDe(usuario);
    const regIds = new Set(registros.map(r => r.id));
    return gerarAlertas(db, hoje)
      .filter(a => {
        if (escopo === 'TUDO') return true;
        if (escopo === 'DEPARTAMENTO') return !a.departamentoId || a.departamentoId === usuario.departamentoId;
        return (a.registroId && regIds.has(a.registroId)) || a.registroId === usuario.id;
      })
      .map(a => ({ ...a, reconhecido: reconhecidos.has(a.chave) }));
  }, [db, hoje, registros, usuario]);

  const navegar = useCallback((pagina: PaginaId, registroId?: ID) => setNav({ pagina, registroId }), []);

  const valor: GovernanceState = {
    db, ix, hoje, usuario, trocarUsuario, pode: p => pode(usuario, p),
    registros, usuariosEscopo, incidentesEscopo,
    filtros, setFiltros, registrosFiltrados, incidentesFiltrados,
    alertas, nav, navegar,
    submeterRegistro, atualizarRegistro, ajustarRisco, alterarStatusRegistro,
    avancarEtapa, decidir, homologar, registrarRevisao,
    salvar, excluir, salvarConfiguracoes, reconhecerAlerta, restaurarDemonstracao,
    toasts, notificar,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
};

/** Executa uma ação e converte exceções de regra/permissão em notificação. */
export const useAcao = () => {
  const { notificar } = useGovernanca();
  return useCallback(
    (fn: () => void, sucesso?: string): boolean => {
      try {
        fn();
        if (sucesso) notificar(sucesso);
        return true;
      } catch (e) {
        notificar(e instanceof Error ? e.message : 'Não foi possível concluir a ação.', 'erro');
        return false;
      }
    },
    [notificar],
  );
};
