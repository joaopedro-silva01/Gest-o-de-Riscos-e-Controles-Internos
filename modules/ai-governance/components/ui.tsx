/**
 * Componentes visuais reutilizáveis do módulo.
 * Seguem o padrão do painel existente (cards brancos, bordas slate, rounded-xl)
 * com a identidade "gov" (azul escuro, azul claro, dourado) definida no index.html.
 */
import React, { useEffect } from 'react';
import { X, Inbox } from 'lucide-react';
import { CATEGORIA_LABEL, NIVEL_ALERTA_LABEL, NIVEL_RISCO_LABEL } from '../domain/catalogs';
import type { CategoriaHomologacao, NivelAlerta, NivelRisco, StatusUso } from '../domain/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------------ Tipografia / layout

export const PageHeader: React.FC<{ titulo: string; subtitulo?: React.ReactNode; acoes?: React.ReactNode; selo?: string }> = ({ titulo, subtitulo, acoes, selo }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {selo && <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gov-golddeep mb-1">{selo}</p>}
      <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">{titulo}</h2>
      {subtitulo && <p className="text-slate-500 text-sm mt-0.5">{subtitulo}</p>}
    </div>
    {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
  </div>
);

export const Card: React.FC<{ titulo?: React.ReactNode; subtitulo?: React.ReactNode; acoes?: React.ReactNode; className?: string; corpo?: string; children: React.ReactNode }> = ({ titulo, subtitulo, acoes, className, corpo = 'p-5', children }) => (
  <section className={cx('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
    {(titulo || acoes) && (
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          {titulo && <h3 className="font-bold text-slate-800 text-sm">{titulo}</h3>}
          {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {acoes}
      </header>
    )}
    <div className={corpo}>{children}</div>
  </section>
);

type Tom = 'neutro' | 'azul' | 'verde' | 'amarelo' | 'laranja' | 'vermelho' | 'dourado' | 'navy';

const TOM_KPI: Record<Tom, string> = {
  neutro: 'text-slate-800',
  azul: 'text-gov-blue',
  navy: 'text-gov-navy',
  verde: 'text-emerald-700',
  amarelo: 'text-amber-700',
  laranja: 'text-orange-700',
  vermelho: 'text-red-700',
  dourado: 'text-gov-golddeep',
};

export const KpiCard: React.FC<{ rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; tom?: Tom; icone?: React.ReactNode; onClick?: () => void }> = ({ rotulo, valor, detalhe, tom = 'neutro', icone, onClick }) => {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cx(
        'text-left bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full',
        onClick && 'hover:border-gov-sky hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gov-sky',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{rotulo}</h3>
        {icone && <span className="text-slate-400 shrink-0">{icone}</span>}
      </div>
      <div className={cx('text-2xl sm:text-3xl font-bold mt-1', TOM_KPI[tom])}>{valor}</div>
      {detalhe && <div className="text-xs text-slate-500 mt-0.5">{detalhe}</div>}
    </Comp>
  );
};

// ------------------------------------------------------------------ Badges

const TOM_BADGE: Record<Tom, string> = {
  neutro: 'bg-slate-100 text-slate-700 border-slate-200',
  azul: 'bg-gov-light text-gov-blue border-blue-200',
  navy: 'bg-gov-navy text-white border-gov-navy',
  verde: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amarelo: 'bg-amber-50 text-amber-800 border-amber-200',
  laranja: 'bg-orange-50 text-orange-800 border-orange-200',
  vermelho: 'bg-red-50 text-red-800 border-red-200',
  dourado: 'bg-gov-goldsoft text-gov-golddeep border-amber-200',
};

export const Badge: React.FC<{ tom?: Tom; children: React.ReactNode; className?: string; title?: string }> = ({ tom = 'neutro', children, className, title }) => (
  <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-semibold border', TOM_BADGE[tom], className)}>
    {children}
  </span>
);

const TOM_RISCO: Record<NivelRisco, Tom> = { BAIXO: 'verde', MEDIO: 'amarelo', ALTO: 'laranja', CRITICO: 'vermelho' };
/** Ícone textual acompanha a cor: nunca comunicamos risco só por cor. */
const ICONE_RISCO: Record<NivelRisco, string> = { BAIXO: '●', MEDIO: '▲', ALTO: '◆', CRITICO: '■' };

export const RiscoBadge: React.FC<{ nivel: NivelRisco; ajustado?: boolean }> = ({ nivel, ajustado }) => (
  <Badge tom={TOM_RISCO[nivel]} title={ajustado ? 'Nível ajustado manualmente (ver justificativa)' : undefined}>
    <span aria-hidden>{ICONE_RISCO[nivel]}</span>
    {NIVEL_RISCO_LABEL[nivel]}
    {ajustado && <span aria-label="ajustado">*</span>}
  </Badge>
);

const TOM_STATUS: Record<StatusUso, Tom> = {
  'Em análise': 'azul',
  'Aguardando aprovação': 'amarelo',
  Aprovado: 'verde',
  'Aprovado com restrições': 'dourado',
  'Em monitoramento': 'azul',
  Suspenso: 'laranja',
  'Não aprovado': 'vermelho',
  Encerrado: 'neutro',
};
export const StatusBadge: React.FC<{ status: StatusUso }> = ({ status }) => <Badge tom={TOM_STATUS[status]}>{status}</Badge>;

const TOM_CATEGORIA: Record<CategoriaHomologacao, Tom> = { HOMOLOGADA: 'verde', USO_MEDIANTE_APROVACAO: 'dourado', NAO_HOMOLOGADA: 'vermelho' };
export const CategoriaBadge: React.FC<{ categoria: CategoriaHomologacao }> = ({ categoria }) => (
  <Badge tom={TOM_CATEGORIA[categoria]}>{CATEGORIA_LABEL[categoria].toUpperCase()}</Badge>
);

const TOM_ALERTA: Record<NivelAlerta, Tom> = { INFORMATIVO: 'azul', ATENCAO: 'amarelo', ALERTA: 'laranja', CRITICO: 'vermelho' };
export const AlertaBadge: React.FC<{ nivel: NivelAlerta }> = ({ nivel }) => <Badge tom={TOM_ALERTA[nivel]}>{NIVEL_ALERTA_LABEL[nivel]}</Badge>;

// ------------------------------------------------------------------ Formulários

export const inputCls =
  'w-full bg-white border border-slate-300 text-slate-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gov-sky/40 focus:border-gov-sky disabled:bg-slate-50 disabled:text-slate-500';

export const Campo: React.FC<{ rotulo: string; obrigatorio?: boolean; ajuda?: React.ReactNode; erro?: string; children: React.ReactNode; className?: string }> = ({ rotulo, obrigatorio, ajuda, erro, children, className }) => (
  <label className={cx('block', className)}>
    <span className="block text-xs font-semibold text-slate-600 mb-1">
      {rotulo} {obrigatorio && <span className="text-red-600">*</span>}
    </span>
    {children}
    {ajuda && !erro && <span className="block text-[11px] text-slate-500 mt-1">{ajuda}</span>}
    {erro && <span className="block text-[11px] text-red-700 mt-1">{erro}</span>}
  </label>
);

/** Pergunta SIM/NÃO usada na classificação de dados (seção 4). */
export const SimNao: React.FC<{ pergunta: string; ajuda?: string; valor: boolean; onChange: (v: boolean) => void; destaque?: boolean }> = ({ pergunta, ajuda, valor, onChange, destaque }) => (
  <div className={cx('flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border', valor && destaque ? 'border-orange-200 bg-orange-50/60' : 'border-slate-200 bg-white')}>
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-800">{pergunta}</p>
      {ajuda && <p className="text-[11px] text-slate-500">{ajuda}</p>}
    </div>
    <div role="radiogroup" aria-label={pergunta} className="flex shrink-0 rounded-lg bg-slate-100 p-0.5">
      {[true, false].map(v => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => onChange(v)}
          className={cx('px-3 py-1 text-xs font-bold rounded-md transition-colors', valor === v ? (v ? 'bg-gov-navy text-white' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-500')}
        >
          {v ? 'SIM' : 'NÃO'}
        </button>
      ))}
    </div>
  </div>
);

type BotaoVariante = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'dourado';
const BOTAO: Record<BotaoVariante, string> = {
  primario: 'bg-gov-navy text-white hover:bg-gov-blue',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  perigo: 'bg-red-700 text-white hover:bg-red-800',
  fantasma: 'text-slate-600 hover:bg-slate-100',
  dourado: 'bg-gov-gold text-gov-navy hover:brightness-105',
};

export const Botao: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: BotaoVariante; icone?: React.ReactNode; tamanho?: 'sm' | 'md' }> = ({ variante = 'primario', icone, tamanho = 'md', className, children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gov-sky',
      tamanho === 'sm' ? 'text-xs px-2.5 py-1.5' : 'text-sm px-4 py-2',
      BOTAO[variante],
      className,
    )}
  >
    {icone}
    {children}
  </button>
);

// ------------------------------------------------------------------ Overlays

export const Modal: React.FC<{ aberto: boolean; titulo: React.ReactNode; subtitulo?: React.ReactNode; onFechar: () => void; children: React.ReactNode; rodape?: React.ReactNode; largura?: 'md' | 'lg' | 'xl' }> = ({ aberto, titulo, subtitulo, onFechar, children, rodape, largura = 'lg' }) => {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  const w = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' }[largura];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gov-navy/40 backdrop-blur-[1px] sm:p-4" onMouseDown={onFechar}>
      <div role="dialog" aria-modal="true" className={cx('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92vh]', w)} onMouseDown={e => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-bold text-gov-navy">{titulo}</h3>
            {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={onFechar} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {rodape && <footer className="px-5 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2 bg-slate-50 rounded-b-2xl">{rodape}</footer>}
      </div>
    </div>
  );
};

export const Vazio: React.FC<{ texto: string; acao?: React.ReactNode }> = ({ texto, acao }) => (
  <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500">
    <Inbox className="w-8 h-8 mb-2 text-slate-300" />
    <p className="text-sm">{texto}</p>
    {acao && <div className="mt-3">{acao}</div>}
  </div>
);

// ------------------------------------------------------------------ Tabela

export const thCls = 'px-4 py-3 font-bold text-[10px] text-slate-500 uppercase tracking-wider text-left whitespace-nowrap';
export const tdCls = 'px-4 py-3 align-top';

export const Tabela: React.FC<{ cabecalho: React.ReactNode; children: React.ReactNode; minWidth?: number }> = ({ cabecalho, children, minWidth = 720 }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-slate-700" style={{ minWidth }}>
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>{cabecalho}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);

/** Par rótulo/valor em fichas de detalhe. */
export const Info: React.FC<{ rotulo: string; children: React.ReactNode; className?: string }> = ({ rotulo, children, className }) => (
  <div className={className}>
    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{rotulo}</dt>
    <dd className="text-sm text-slate-800 mt-0.5 break-words">{children || '—'}</dd>
  </div>
);
