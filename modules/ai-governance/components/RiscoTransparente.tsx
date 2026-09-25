/**
 * Exibe COMO o nível de risco foi calculado (sem "caixa preta" — seção 5):
 * cada fator com seus pontos, as regras de piso e os motivos de aprovação.
 */
import React from 'react';
import { ShieldAlert, ShieldCheck, Info as InfoIcon } from 'lucide-react';
import { NIVEL_RISCO_LABEL } from '../domain/catalogs';
import type { AjusteRisco, PesosRisco, ResultadoRisco } from '../domain/types';
import { useGovernanca } from '../state/GovernanceContext';
import { formatarDataHora } from '../utils/dates';
import { RiscoBadge, cx } from './ui';

export const RiscoTransparente: React.FC<{ risco: ResultadoRisco; ajuste?: AjusteRisco; faixas: PesosRisco['faixas']; compacto?: boolean }> = ({ risco, ajuste, faixas, compacto }) => {
  const { ix } = useGovernanca();
  const contribuintes = risco.fatores.filter(f => f.pontos > 0);
  const neutros = risco.fatores.filter(f => f.pontos === 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Risco {ajuste ? 'ajustado' : 'sugerido'}</span>
          <RiscoBadge nivel={ajuste?.nivel ?? risco.nivelSugerido} ajustado={!!ajuste} />
        </div>
        <span className="text-xs text-slate-600">
          Pontuação <strong className="tabular-nums">{risco.pontuacao}</strong> → {NIVEL_RISCO_LABEL[risco.nivelCalculado]}
        </span>
      </div>

      <ul className="space-y-1">
        {contribuintes.map(f => (
          <li key={f.fator} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-slate-700">
              <strong className="font-semibold">{f.fator}</strong>
              {!compacto && <span className="text-slate-500"> — {f.motivo}</span>}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-orange-800">+{f.pontos}</span>
          </li>
        ))}
        {contribuintes.length === 0 && <li className="text-sm text-slate-600">Nenhum fator de risco relevante identificado.</li>}
      </ul>
      {neutros.length > 0 && !compacto && (
        <p className="text-[11px] text-slate-500">Avaliados sem pontuação: {neutros.map(f => f.fator.toLowerCase()).join(', ')}.</p>
      )}

      {risco.regrasAplicadas.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-900">
          <p className="font-bold flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Regras de piso aplicadas</p>
          <ul className="list-disc ml-5 mt-1">{risco.regrasAplicadas.map(r => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      {ajuste && (
        <div className="rounded-lg bg-gov-goldsoft border border-amber-200 px-3 py-2 text-xs text-gov-golddeep">
          <p className="font-bold">Ajuste manual para {NIVEL_RISCO_LABEL[ajuste.nivel]}</p>
          <p className="mt-0.5">{ajuste.justificativa}</p>
          <p className="mt-0.5 opacity-80">{ix.usuarios.get(ajuste.responsavelId)?.nome} · {formatarDataHora(ajuste.data)}</p>
        </div>
      )}

      <div className={cx('rounded-lg px-3 py-2 text-xs border', risco.necessitaAprovacao ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900')}>
        {risco.necessitaAprovacao ? (
          <>
            <p className="font-bold flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Necessita aprovação</p>
            <p className="mt-0.5">{risco.motivosAprovacao.join(' · ')}</p>
          </>
        ) : (
          <p className="font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Aprovação automática por política (ferramenta homologada, sem dados sensíveis/de clientes, risco abaixo de Alto)</p>
        )}
      </div>

      {!compacto && (
        <p className="text-[11px] text-slate-500 flex items-start gap-1">
          <InfoIcon className="w-3 h-3 mt-0.5 shrink-0" />
          Faixas: Baixo &lt; {faixas.medio} ≤ Médio &lt; {faixas.alto} ≤ Alto &lt; {faixas.critico} ≤ Crítico. Pesos editáveis em Configurações.
        </p>
      )}
    </div>
  );
};
