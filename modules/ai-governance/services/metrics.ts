/**
 * Filtros globais (seção 17) e indicadores/gráficos executivos (seções 6, 23 e 24).
 * Tudo parte da lista de registros já recortada pelo escopo do perfil.
 */
import {
  CATEGORIA_COR,
  CATEGORIA_LABEL,
  NIVEIS_RISCO,
  NIVEL_RISCO_COR,
  NIVEL_RISCO_LABEL,
  NIVEL_RISCO_ORDEM,
  STATUS_AUTORIZADOS,
  STATUS_INCIDENTE_ABERTO,
  STATUS_PENDENTES,
  STATUS_USO,
  TIPOS_DADO,
  TIPO_DADO_LABEL,
} from '../domain/catalogs';
import type { Alerta, FiltrosGlobais, GovernanceDB, Incidente, ISODate, RegistroUso, Usuario } from '../domain/types';
import { addMeses, chaveMes, rotuloMes } from '../utils/dates';
import { criarIndices, departamentoDoIncidente, Indices, situacaoTreinamento, usuariosDeIA } from './derived';
import { nivelEfetivo } from './riskEngine';

export const FILTROS_VAZIOS: FiltrosGlobais = {
  empresaId: '', departamentoId: '', colaboradorId: '', ferramentaId: '', status: '', nivelRisco: '',
  tipoDado: '', periodoInicio: '', periodoFim: '', responsavelId: '', homologacao: '',
};

export const filtrosAtivos = (f: FiltrosGlobais): number => Object.values(f).filter(Boolean).length;

export const aplicarFiltros = (registros: RegistroUso[], f: FiltrosGlobais, ix: Indices): RegistroUso[] =>
  registros.filter(r => {
    const colab = ix.usuarios.get(r.colaboradorId);
    const ferr = ix.ferramentas.get(r.ferramentaId);
    if (f.empresaId && colab?.empresaId !== f.empresaId) return false;
    if (f.departamentoId && colab?.departamentoId !== f.departamentoId) return false;
    if (f.colaboradorId && r.colaboradorId !== f.colaboradorId) return false;
    if (f.ferramentaId && r.ferramentaId !== f.ferramentaId) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.nivelRisco && nivelEfetivo(r) !== f.nivelRisco) return false;
    if (f.tipoDado && !r.dados[f.tipoDado as keyof RegistroUso['dados']]) return false;
    if (f.periodoInicio && r.dataInicio < f.periodoInicio) return false;
    if (f.periodoFim && r.dataInicio > f.periodoFim) return false;
    if (f.responsavelId && r.responsavelProcessoId !== f.responsavelId) return false;
    if (f.homologacao && ferr?.categoria !== f.homologacao) return false;
    return true;
  });

/**
 * Incidentes sob os mesmos filtros globais aplicáveis (empresa, departamento,
 * colaborador, ferramenta, período). Status/risco/dado não se aplicam a incidentes.
 */
export const aplicarFiltrosIncidentes = (incidentes: Incidente[], f: FiltrosGlobais, ix: Indices): Incidente[] =>
  incidentes.filter(i => {
    const colab = i.colaboradorId ? ix.usuarios.get(i.colaboradorId) : undefined;
    const depto = departamentoDoIncidente(ix, i);
    if (f.empresaId && colab?.empresaId !== f.empresaId) return false;
    if (f.departamentoId && depto !== f.departamentoId) return false;
    if (f.colaboradorId && i.colaboradorId !== f.colaboradorId) return false;
    if (f.ferramentaId && i.ferramentaId !== f.ferramentaId) return false;
    if (f.periodoInicio && i.data < f.periodoInicio) return false;
    if (f.periodoFim && i.data > f.periodoFim) return false;
    return true;
  });

export interface Serie { nome: string; valor: number; cor?: string }

const contar = <T,>(xs: T[], chave: (x: T) => string | undefined): Serie[] => {
  const m = new Map<string, number>();
  for (const x of xs) {
    const k = chave(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
};

export interface Indicadores {
  totalUsuarios: number;
  totalDepartamentos: number;
  totalFerramentas: number;
  totalRegistros: number;
  homologadas: number;
  aguardandoAprovacao: number;
  comRestricao: number;
  altoRisco: number;
  pendenciasRevisao: number;
  incidentesAbertos: number;
  incidentesTotal: number;
  classificados: number;
}

export const calcularIndicadores = (db: GovernanceDB, registros: RegistroUso[], incidentes: Incidente[], hoje: ISODate): Indicadores => {
  const ativos = registros.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado');
  const usuarios = usuariosDeIA(db, registros);
  const deptos = new Set(usuarios.map(u => u.departamentoId));
  return {
    totalUsuarios: usuarios.length,
    totalDepartamentos: deptos.size,
    totalFerramentas: db.ferramentas.length,
    totalRegistros: registros.length,
    homologadas: registros.filter(r => STATUS_AUTORIZADOS.includes(r.status)).length,
    aguardandoAprovacao: registros.filter(r => STATUS_PENDENTES.includes(r.status)).length,
    comRestricao: registros.filter(r => r.status === 'Aprovado com restrições' || r.status === 'Suspenso').length,
    altoRisco: ativos.filter(r => NIVEL_RISCO_ORDEM[nivelEfetivo(r)] >= NIVEL_RISCO_ORDEM.ALTO).length,
    pendenciasRevisao: ativos.filter(r => STATUS_AUTORIZADOS.includes(r.status) && r.proximaRevisao && r.proximaRevisao < hoje).length,
    incidentesAbertos: incidentes.filter(i => STATUS_INCIDENTE_ABERTO.includes(i.status)).length,
    incidentesTotal: incidentes.length,
    classificados: registros.filter(r => r.risco.fatores.length > 0).length,
  };
};

export interface Graficos {
  porDepartamento: Serie[];
  porFerramenta: Serie[];
  porEmpresa: Serie[];
  porRisco: Serie[];
  porStatus: Serie[];
  tiposDado: Serie[];
  homologadasVsNao: Serie[];
  evolucaoMensal: { mes: string; registros: number; acumulado: number }[];
  porFinalidade: Serie[];
  processos: Serie[];
}

export const calcularGraficos = (db: GovernanceDB, registros: RegistroUso[], hoje: ISODate, ix = criarIndices(db)): Graficos => {

  // Evolução mensal: últimos 12 meses, com acumulado.
  const meses: string[] = [];
  for (let i = 11; i >= 0; i--) meses.push(chaveMes(addMeses(hoje, -i)));
  const porMes = new Map(meses.map(m => [m, 0]));
  let acumuladoAntes = 0;
  for (const r of registros) {
    const k = chaveMes(r.dataInicio);
    if (porMes.has(k)) porMes.set(k, porMes.get(k)! + 1);
    else if (k < meses[0]) acumuladoAntes++;
  }
  let acc = acumuladoAntes;
  const evolucaoMensal = meses.map(m => {
    acc += porMes.get(m)!;
    return { mes: rotuloMes(m), registros: porMes.get(m)!, acumulado: acc };
  });

  const categoria = (r: RegistroUso) => ix.ferramentas.get(r.ferramentaId)?.categoria;

  return {
    porDepartamento: contar(registros, r => ix.departamentos.get(ix.usuarios.get(r.colaboradorId)?.departamentoId ?? '')?.nome),
    porFerramenta: contar(registros, r => ix.ferramentas.get(r.ferramentaId)?.nome),
    porEmpresa: contar(registros, r => ix.empresas.get(ix.usuarios.get(r.colaboradorId)?.empresaId ?? '')?.nome),
    porRisco: NIVEIS_RISCO.map(n => ({ nome: NIVEL_RISCO_LABEL[n], valor: registros.filter(r => nivelEfetivo(r) === n).length, cor: NIVEL_RISCO_COR[n] })),
    porStatus: STATUS_USO.map(s => ({ nome: s, valor: registros.filter(r => r.status === s).length })).filter(s => s.valor > 0),
    tiposDado: TIPOS_DADO.map(t => ({ nome: TIPO_DADO_LABEL[t], valor: registros.filter(r => r.dados[t]).length })),
    homologadasVsNao: [
      { nome: CATEGORIA_LABEL.HOMOLOGADA, valor: registros.filter(r => categoria(r) === 'HOMOLOGADA').length, cor: CATEGORIA_COR.HOMOLOGADA },
      { nome: 'Mediante aprovação', valor: registros.filter(r => categoria(r) === 'USO_MEDIANTE_APROVACAO').length, cor: CATEGORIA_COR.USO_MEDIANTE_APROVACAO },
      { nome: 'Não homologada', valor: registros.filter(r => categoria(r) === 'NAO_HOMOLOGADA').length, cor: CATEGORIA_COR.NAO_HOMOLOGADA },
    ],
    evolucaoMensal,
    porFinalidade: contar(registros, r => r.finalidade),
    processos: contar(registros, r => r.processo).slice(0, 8),
  };
};

/** Indicadores dos cinco pilares (seção 23). */
export interface Pilares {
  homologar: { ferramentas: number; homologadas: number; emAnalise: number; restritas: number };
  orientar: { colaboradores: number; treinados: number; pendentes: number; vencidos: number };
  controlar: { casos: number; controlados: number; pendentes: number };
  monitorar: { alertas: number; criticos: number; incidentesAbertos: number };
  evoluir: { melhorias: number; implantadas: number; emImplantacao: number };
}

export const calcularPilares = (db: GovernanceDB, registros: RegistroUso[], usuariosEscopo: Usuario[], incidentes: Incidente[], alertas: Alerta[], hoje: ISODate): Pilares => {
  const usuarios = usuariosDeIA(db, registros).filter(u => usuariosEscopo.some(x => x.id === u.id));
  const situacoes = usuarios.map(u => situacaoTreinamento(db, u, hoje));
  const ativos = registros.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado');
  // "Controlado" = autorizado, com pelo menos um controle aplicado e revisão em dia.
  const controlados = ativos.filter(r => STATUS_AUTORIZADOS.includes(r.status) && r.controleIds.length > 0 && (!r.proximaRevisao || r.proximaRevisao >= hoje));
  return {
    homologar: {
      ferramentas: db.ferramentas.length,
      homologadas: db.ferramentas.filter(f => f.categoria === 'HOMOLOGADA').length,
      emAnalise: db.ferramentas.filter(f => f.status === 'Em avaliação' || f.categoria === 'USO_MEDIANTE_APROVACAO').length,
      restritas: db.ferramentas.filter(f => f.categoria === 'NAO_HOMOLOGADA').length,
    },
    orientar: {
      colaboradores: usuarios.length,
      treinados: situacoes.filter(s => s === 'Treinado').length,
      pendentes: situacoes.filter(s => s === 'Pendente').length,
      vencidos: situacoes.filter(s => s === 'Vencido').length,
    },
    controlar: { casos: ativos.length, controlados: controlados.length, pendentes: ativos.length - controlados.length },
    monitorar: {
      alertas: alertas.length,
      criticos: alertas.filter(a => a.nivel === 'CRITICO').length,
      incidentesAbertos: incidentes.filter(i => STATUS_INCIDENTE_ABERTO.includes(i.status)).length,
    },
    evoluir: {
      melhorias: db.melhorias.length,
      implantadas: db.melhorias.filter(m => m.status === 'Implantada').length,
      emImplantacao: db.melhorias.filter(m => m.status === 'Em implantação').length,
    },
  };
};

/** Exposição por departamento: soma ponderada dos níveis de risco dos usos ativos. */
export const exposicaoPorDepartamento = (db: GovernanceDB, registros: RegistroUso[], ix = criarIndices(db)) => {
  const peso = { BAIXO: 1, MEDIO: 2, ALTO: 4, CRITICO: 8 } as const;
  const m = new Map<string, number>();
  for (const r of registros.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado')) {
    const d = ix.departamentos.get(ix.usuarios.get(r.colaboradorId)?.departamentoId ?? '')?.nome;
    if (d) m.set(d, (m.get(d) ?? 0) + peso[nivelEfetivo(r)]);
  }
  return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
};
