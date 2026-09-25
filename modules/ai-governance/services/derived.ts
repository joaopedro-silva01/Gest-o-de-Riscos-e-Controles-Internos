/**
 * Consultas derivadas (joins) reutilizadas por métricas, alertas e telas.
 * Evitam duplicar dados: departamento/empresa/cargo de um registro vêm sempre do colaborador.
 */
import type { GovernanceDB, ID, ISODate, Incidente, Participacao, RegistroUso, StatusTreinamento, Usuario } from '../domain/types';

export interface Indices {
  usuarios: Map<ID, GovernanceDB['usuarios'][number]>;
  departamentos: Map<ID, GovernanceDB['departamentos'][number]>;
  empresas: Map<ID, GovernanceDB['empresas'][number]>;
  ferramentas: Map<ID, GovernanceDB['ferramentas'][number]>;
  casosUso: Map<ID, GovernanceDB['casosUso'][number]>;
  aprovacoes: Map<ID, GovernanceDB['aprovacoes'][number]>;
  controles: Map<ID, GovernanceDB['controles'][number]>;
  politicas: Map<ID, GovernanceDB['politicas'][number]>;
  treinamentos: Map<ID, GovernanceDB['treinamentos'][number]>;
}

const porId = <T extends { id: ID }>(xs: T[]) => new Map(xs.map(x => [x.id, x]));

export const criarIndices = (db: GovernanceDB): Indices => ({
  usuarios: porId(db.usuarios),
  departamentos: porId(db.departamentos),
  empresas: porId(db.empresas),
  ferramentas: porId(db.ferramentas),
  casosUso: porId(db.casosUso),
  aprovacoes: porId(db.aprovacoes),
  controles: porId(db.controles),
  politicas: porId(db.politicas),
  treinamentos: porId(db.treinamentos),
});

export const nome = (ix: Indices, usuarioId?: ID): string => (usuarioId && ix.usuarios.get(usuarioId)?.nome) || '—';

export const departamentoDoRegistro = (ix: Indices, r: RegistroUso): ID | undefined => ix.usuarios.get(r.colaboradorId)?.departamentoId;
export const empresaDoRegistro = (ix: Indices, r: RegistroUso): ID | undefined => ix.usuarios.get(r.colaboradorId)?.empresaId;

export const departamentoDoIncidente = (ix: Indices, i: Incidente): ID | undefined =>
  (i.colaboradorId && ix.usuarios.get(i.colaboradorId)?.departamentoId) || i.departamentoId;

/** Status efetivo de uma participação: reciclagem vencida transforma "Concluído" em "Vencido". */
export const statusParticipacao = (p: Participacao, hoje: ISODate): StatusTreinamento =>
  p.status === 'Concluído' && p.proximaReciclagem && p.proximaReciclagem < hoje ? 'Vencido' : p.status;

export type SituacaoTreinamento = 'Treinado' | 'Pendente' | 'Vencido';

/**
 * Situação do colaborador frente aos treinamentos OBRIGATÓRIOS:
 * - Treinado: concluiu todos e nenhum está vencido;
 * - Vencido: algum obrigatório está com reciclagem vencida;
 * - Pendente: falta concluir algum obrigatório.
 */
export const situacaoTreinamento = (db: GovernanceDB, usuario: Usuario, hoje: ISODate): SituacaoTreinamento => {
  const obrigatorios = db.treinamentos.filter(t => t.obrigatorio);
  let vencido = false;
  for (const t of obrigatorios) {
    const p = db.participacoes.find(x => x.treinamentoId === t.id && x.colaboradorId === usuario.id);
    if (!p) return 'Pendente';
    const st = statusParticipacao(p, hoje);
    if (st === 'Vencido') vencido = true;
    else if (st !== 'Concluído') return 'Pendente';
  }
  return vencido ? 'Vencido' : 'Treinado';
};

/** Usuários que utilizam IA (possuem ao menos um registro de uso não encerrado/reprovado). */
export const usuariosDeIA = (db: GovernanceDB, registros: RegistroUso[] = db.registrosUso): Usuario[] => {
  const ids = new Set(registros.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado').map(r => r.colaboradorId));
  return db.usuarios.filter(u => ids.has(u.id));
};
