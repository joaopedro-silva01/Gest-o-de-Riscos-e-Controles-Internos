/** Utilitários de data e identificadores usados em todo o módulo. */
import type { ISODate, ISODateTime } from '../domain/types';

export const toISODate = (d: Date): ISODate => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const hoje = (): ISODate => toISODate(new Date());
export const agora = (): ISODateTime => new Date().toISOString();

/** Converte `YYYY-MM-DD` em Date local (evita o deslocamento de fuso do `new Date(iso)`). */
export const parseISODate = (iso: ISODate): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDias = (iso: ISODate, dias: number): ISODate => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + dias);
  return toISODate(d);
};

export const addMeses = (iso: ISODate, meses: number): ISODate => {
  const d = parseISODate(iso);
  d.setMonth(d.getMonth() + meses);
  return toISODate(d);
};

/** Diferença em dias (b - a). */
export const diasEntre = (a: ISODate, b: ISODate): number =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);

export const formatarData = (iso?: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export const formatarDataHora = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Chave `YYYY-MM` para agregações mensais. */
export const chaveMes = (iso: ISODate): string => iso.slice(0, 7);

export const rotuloMes = (chave: string): string => {
  const [y, m] = chave.split('-').map(Number);
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[m - 1]}/${String(y).slice(2)}`;
};

let contador = 0;
/** ID único local. Em backend real será substituído pelo ID do banco. */
export const novoId = (prefixo: string): string =>
  `${prefixo}-${Date.now().toString(36)}-${(contador++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
