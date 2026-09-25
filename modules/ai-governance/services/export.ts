/**
 * Exportação de dados (seção 22). CSV e JSON disponíveis agora; PDF/Excel previstos.
 * O CSV usa ";" e BOM UTF-8 para abrir corretamente no Excel em pt-BR.
 */

export interface ColunaCsv<T> {
  titulo: string;
  valor: (item: T) => string | number | boolean | undefined | null;
}

const escapar = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const gerarCsv = <T,>(itens: T[], colunas: ColunaCsv<T>[]): string =>
  [colunas.map(c => escapar(c.titulo)).join(';'), ...itens.map(i => colunas.map(c => escapar(c.valor(i))).join(';'))].join('\r\n');

export const baixarArquivo = (conteudo: string, nomeArquivo: string, mime: string) => {
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' + conteudo : conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportarCsv = <T,>(itens: T[], colunas: ColunaCsv<T>[], nomeArquivo: string) =>
  baixarArquivo(gerarCsv(itens, colunas), nomeArquivo, 'text/csv;charset=utf-8');

export const exportarJson = (dados: unknown, nomeArquivo: string) =>
  baixarArquivo(JSON.stringify(dados, null, 2), nomeArquivo, 'application/json');
