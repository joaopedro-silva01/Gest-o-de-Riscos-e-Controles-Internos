/**
 * Fluxo de homologação (seção 10):
 * SOLICITAÇÃO → ANÁLISE → CLASSIFICAÇÃO DE RISCO → AVALIAÇÃO DE DADOS →
 * APROVAÇÃO → HOMOLOGAÇÃO → MONITORAMENTO → REVISÃO
 *
 * Funções puras: recebem o estado atual e devolvem o novo estado.
 * Quem grava (e audita) é o GovernanceContext.
 */
import { ETAPAS_FLUXO, ETAPA_LABEL } from '../domain/catalogs';
import type { Aprovacao, EtapaAprovacao, EtapaFluxo, ID, ISODate, ISODateTime, NivelRisco, RegistroUso, StatusUso } from '../domain/types';
import { addMeses } from '../utils/dates';
import { nivelEfetivo } from './riskEngine';

export type Decisao = NonNullable<Aprovacao['decisao']>;

/** Etapas conduzidas manualmente antes da decisão. */
const ETAPAS_PRE_DECISAO: EtapaFluxo[] = ['ANALISE', 'CLASSIFICACAO_RISCO', 'AVALIACAO_DADOS'];

export const criarFluxo = (
  registro: RegistroUso,
  id: ID,
  solicitanteId: ID,
  quando: ISODateTime,
): { aprovacao: Aprovacao; status: StatusUso } => {
  const etapas: EtapaAprovacao[] = ETAPAS_FLUXO.map(etapa => ({ etapa, status: 'Pendente' }));
  const set = (etapa: EtapaFluxo, patch: Partial<EtapaAprovacao>) => {
    const i = etapas.findIndex(e => e.etapa === etapa);
    etapas[i] = { ...etapas[i], ...patch };
  };
  set('SOLICITACAO', { status: 'Concluída', responsavelId: solicitanteId, data: quando, observacao: 'Solicitação registrada.' });

  if (!registro.risco.necessitaAprovacao) {
    // Aprovação automática por política: ferramenta homologada, risco baixo/médio,
    // sem dado sensível ou de cliente. Continua rastreável no fluxo.
    const obs = 'Aprovação automática por política: ferramenta homologada, sem dados sensíveis/de clientes e risco abaixo de Alto.';
    for (const etapa of [...ETAPAS_PRE_DECISAO, 'APROVACAO', 'HOMOLOGACAO'] as EtapaFluxo[]) {
      set(etapa, { status: 'Concluída', data: quando, observacao: obs });
    }
    set('MONITORAMENTO', { status: 'Em andamento', data: quando });
    return {
      aprovacao: { id, registroUsoId: registro.id, solicitanteId, dataSolicitacao: quando, etapas, decisao: 'Aprovado', dataDecisao: quando, justificativa: obs, automatica: true },
      status: 'Aprovado',
    };
  }

  set('ANALISE', { status: 'Em andamento' });
  return {
    aprovacao: { id, registroUsoId: registro.id, solicitanteId, dataSolicitacao: quando, etapas, automatica: false },
    status: 'Aguardando aprovação',
  };
};

/** Etapa em andamento (ou a primeira pendente). */
export const etapaAtual = (a: Aprovacao): EtapaAprovacao | undefined =>
  a.etapas.find(e => e.status === 'Em andamento') ?? a.etapas.find(e => e.status === 'Pendente');

export const podeAvancar = (a: Aprovacao): boolean => {
  const atual = etapaAtual(a);
  return !!atual && ETAPAS_PRE_DECISAO.includes(atual.etapa);
};

export const aguardandoDecisao = (a: Aprovacao): boolean => etapaAtual(a)?.etapa === 'APROVACAO' && !a.decisao;

export const aguardandoHomologacao = (a: Aprovacao): boolean => etapaAtual(a)?.etapa === 'HOMOLOGACAO';

const concluirEAvancar = (a: Aprovacao, usuarioId: ID, quando: ISODateTime, observacao: string, statusFinal: EtapaAprovacao['status'] = 'Concluída'): Aprovacao => {
  const atual = etapaAtual(a);
  if (!atual) return a;
  const idx = a.etapas.findIndex(e => e.etapa === atual.etapa);
  const etapas = a.etapas.map((e, i) => {
    if (i === idx) return { ...e, status: statusFinal, responsavelId: usuarioId, data: quando, observacao: observacao || e.observacao };
    if (i === idx + 1 && statusFinal === 'Concluída') return { ...e, status: 'Em andamento' as const };
    return e;
  });
  return { ...a, etapas };
};

/** Conclui uma etapa de análise (Análise, Classificação de risco, Avaliação de dados). */
export const avancarEtapa = (a: Aprovacao, usuarioId: ID, quando: ISODateTime, observacao: string): Aprovacao => {
  if (!podeAvancar(a)) throw new Error('A etapa atual não pode ser avançada manualmente.');
  return concluirEAvancar(a, usuarioId, quando, observacao);
};

/** Registra a decisão da etapa APROVAÇÃO. */
export const decidir = (
  a: Aprovacao,
  decisao: Decisao,
  usuarioId: ID,
  quando: ISODateTime,
  justificativa: string,
): { aprovacao: Aprovacao; status: StatusUso } => {
  if (!aguardandoDecisao(a)) throw new Error('O fluxo não está na etapa de Aprovação.');
  if (decisao !== 'Aprovado' && !justificativa.trim()) throw new Error('Justificativa obrigatória para reprovação ou restrição.');
  const reprovado = decisao === 'Não aprovado';
  let aprov = concluirEAvancar(a, usuarioId, quando, justificativa, reprovado ? 'Reprovada' : 'Concluída');
  if (reprovado) {
    aprov = { ...aprov, etapas: aprov.etapas.map(e => (e.status === 'Pendente' ? { ...e, status: 'Não aplicável' as const } : e)) };
  }
  return {
    aprovacao: { ...aprov, decisao, aprovadorId: usuarioId, dataDecisao: quando, justificativa },
    status: decisao,
  };
};

/** Conclui a HOMOLOGAÇÃO (configuração de controles/acesso) e inicia o monitoramento. */
export const homologar = (a: Aprovacao, usuarioId: ID, quando: ISODateTime, observacao: string): Aprovacao => {
  if (!aguardandoHomologacao(a)) throw new Error('O fluxo não está na etapa de Homologação.');
  return concluirEAvancar(a, usuarioId, quando, observacao || 'Uso homologado e controles configurados.');
};

/** Registra uma revisão periódica. MONITORAMENTO continua em andamento (ciclo). */
export const registrarRevisao = (a: Aprovacao, usuarioId: ID, quando: ISODateTime, observacao: string): Aprovacao => ({
  ...a,
  etapas: a.etapas.map(e =>
    e.etapa === 'REVISAO' ? { ...e, status: 'Concluída', responsavelId: usuarioId, data: quando, observacao: observacao || 'Revisão periódica realizada.' } : e,
  ),
});

export const proximaRevisao = (base: ISODate, nivel: NivelRisco, periodicidade: Record<NivelRisco, number>): ISODate =>
  addMeses(base, periodicidade[nivel]);

export const proximaRevisaoRegistro = (r: RegistroUso, base: ISODate, periodicidade: Record<NivelRisco, number>): ISODate =>
  proximaRevisao(base, nivelEfetivo(r), periodicidade);

export const descricaoEtapa = (etapa: EtapaFluxo): string => ETAPA_LABEL[etapa];
