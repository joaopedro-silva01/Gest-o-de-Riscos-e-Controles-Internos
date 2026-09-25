/** Tabela de Registros de Uso — compartilhada por Governança e Aprovações. */
import React from 'react';
import { ETAPA_LABEL, STATUS_AUTORIZADOS, TIPOS_DADO, TIPO_DADO_LABEL } from '../domain/catalogs';
import type { RegistroUso } from '../domain/types';
import { departamentoDoRegistro } from '../services/derived';
import { nivelEfetivo } from '../services/riskEngine';
import { etapaAtual } from '../services/workflow';
import { useGovernanca } from '../state/GovernanceContext';
import { formatarData } from '../utils/dates';
import { Badge, CategoriaBadge, RiscoBadge, StatusBadge, Tabela, Vazio, cx, tdCls, thCls } from './ui';

const SIGLA: Record<string, string> = { pessoal: 'PES', sensivel: 'SEN', cliente: 'CLI', financeiro: 'FIN', contratual: 'CON', estrategico: 'EST' };

export const RegistrosTabela: React.FC<{ registros: RegistroUso[]; onAbrir: (id: string) => void; vazio?: string }> = ({ registros, onAbrir, vazio = 'Nenhuma utilização encontrada.' }) => {
  const { ix, hoje } = useGovernanca();
  if (!registros.length) return <Vazio texto={vazio} />;
  return (
    <Tabela
      minWidth={1060}
      cabecalho={
        <>
          <th className={thCls}>Código</th>
          <th className={thCls}>Colaborador / área</th>
          <th className={thCls}>Ferramenta</th>
          <th className={thCls}>Atividade / finalidade</th>
          <th className={thCls}>Dados</th>
          <th className={thCls}>Risco</th>
          <th className={thCls}>Status</th>
          <th className={thCls}>Etapa</th>
          <th className={thCls}>Próx. revisão</th>
        </>
      }
    >
      {registros.map(r => {
        const f = ix.ferramentas.get(r.ferramentaId);
        const a = r.aprovacaoId ? ix.aprovacoes.get(r.aprovacaoId) : undefined;
        const etapa = a && !a.etapas.some(e => e.status === 'Reprovada') ? etapaAtual(a) : undefined;
        const vencida = r.proximaRevisao && r.proximaRevisao < hoje && STATUS_AUTORIZADOS.includes(r.status);
        const tipos = TIPOS_DADO.filter(t => r.dados[t]);
        return (
          <tr key={r.id} onClick={() => onAbrir(r.id)} className="hover:bg-gov-light/40 cursor-pointer" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onAbrir(r.id)}>
            <td className={cx(tdCls, 'font-mono text-xs font-semibold text-gov-blue whitespace-nowrap')}>{r.codigo}</td>
            <td className={tdCls}>
              <p className="font-medium text-slate-800">{ix.usuarios.get(r.colaboradorId)?.nome}</p>
              <p className="text-xs text-slate-500">{ix.departamentos.get(departamentoDoRegistro(ix, r) ?? '')?.nome}</p>
            </td>
            <td className={tdCls}>
              <p className="font-medium">{f?.nome}</p>
              {f && <div className="mt-0.5 scale-90 origin-left"><CategoriaBadge categoria={f.categoria} /></div>}
            </td>
            <td className={tdCls}>
              <p className="text-slate-800 line-clamp-2">{r.atividade}</p>
              <p className="text-xs text-slate-500">{r.finalidade} · {r.frequencia}</p>
            </td>
            <td className={tdCls}>
              <div className="flex flex-wrap gap-1 max-w-[140px]">
                {tipos.length ? tipos.map(t => <Badge key={t} tom={t === 'sensivel' ? 'vermelho' : 'laranja'} title={TIPO_DADO_LABEL[t]}>{SIGLA[t]}</Badge>) : <span className="text-xs text-slate-500">Nenhum protegido</span>}
              </div>
            </td>
            <td className={tdCls}><RiscoBadge nivel={nivelEfetivo(r)} ajustado={!!r.ajusteRisco} /></td>
            <td className={tdCls}><StatusBadge status={r.status} /></td>
            <td className={cx(tdCls, 'text-xs text-slate-600 whitespace-nowrap')}>{etapa ? ETAPA_LABEL[etapa.etapa] : '—'}</td>
            <td className={cx(tdCls, 'text-xs whitespace-nowrap', vencida ? 'text-red-700 font-semibold' : 'text-slate-600')}>{formatarData(r.proximaRevisao)}{vencida && ' ⚠'}</td>
          </tr>
        );
      })}
    </Tabela>
  );
};

export const LegendaDados: React.FC = () => (
  <p className="text-[11px] text-slate-500">
    Dados: {Object.entries(SIGLA).map(([k, s]) => `${s} = ${TIPO_DADO_LABEL[k as keyof typeof TIPO_DADO_LABEL]}`).join(' · ')}
  </p>
);
