/**
 * Trilha de auditoria (seção 16): quem, o quê, valor anterior, novo valor, data e hora.
 * O diff é feito campo a campo (1º nível); objetos aninhados são comparados por valor.
 */
import type { AcaoAuditoria, AlteracaoCampo, Entidade, EventoAuditoria, ID } from '../domain/types';
import { agora, novoId } from '../utils/dates';

/** Campos técnicos que não interessam à auditoria. */
const IGNORAR = new Set(['id', 'criadoEm', 'criadoPorId', 'risco']);

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const diff = <T extends object>(antes: T | undefined, depois: T | undefined): AlteracaoCampo[] => {
  const a = (antes ?? {}) as Record<string, unknown>;
  const d = (depois ?? {}) as Record<string, unknown>;
  const campos = new Set([...Object.keys(a), ...Object.keys(d)]);
  const out: AlteracaoCampo[] = [];
  for (const campo of campos) {
    if (IGNORAR.has(campo)) continue;
    if (!igual(a[campo], d[campo])) out.push({ campo, anterior: a[campo], novo: d[campo] });
  }
  return out;
};

export interface NovoEvento {
  usuarioId: ID;
  entidade: Entidade;
  registroId: ID;
  registroRotulo: string;
  acao: AcaoAuditoria;
  alteracoes?: AlteracaoCampo[];
  departamentoId?: ID;
}

export const criarEvento = (e: NovoEvento): EventoAuditoria => ({
  id: novoId('aud'),
  dataHora: agora(),
  alteracoes: [],
  ...e,
});

/** Representação legível de um valor auditado. */
export const valorLegivel = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.length ? v.map(valorLegivel).join(', ') : '—';
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${valorLegivel(val)}`)
      .join('; ');
  }
  return String(v);
};
