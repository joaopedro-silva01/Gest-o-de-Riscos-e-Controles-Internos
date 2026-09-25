/**
 * ⚠ Riscos e Alertas — Central de Alertas de Governança (seção 15)
 * e registro corporativo de riscos de IA.
 *
 * Etapa 1: central de alertas funcional (derivada das regras) + consulta ao registro de riscos.
 * Etapa 3: cadastro/edição de riscos e matriz probabilidade × impacto.
 */
import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCheck } from 'lucide-react';
import { AlertaBadge, Badge, Botao, Card, KpiCard, PageHeader, RiscoBadge, Tabela, Vazio, cx, tdCls, thCls } from '../components/ui';
import { NIVEL_ALERTA_LABEL } from '../domain/catalogs';
import type { NivelAlerta } from '../domain/types';
import { nome } from '../services/derived';
import { useAcao, useGovernanca } from '../state/GovernanceContext';

const NIVEIS: NivelAlerta[] = ['CRITICO', 'ALERTA', 'ATENCAO', 'INFORMATIVO'];

export const RiscosAlertasPage: React.FC = () => {
  const { alertas, navegar, pode, reconhecerAlerta, db, ix } = useGovernanca();
  const executar = useAcao();
  const [nivel, setNivel] = useState<NivelAlerta | ''>('');
  const [mostrarReconhecidos, setMostrarReconhecidos] = useState(false);

  const lista = useMemo(
    () => alertas.filter(a => (!nivel || a.nivel === nivel) && (mostrarReconhecidos || !a.reconhecido)),
    [alertas, nivel, mostrarReconhecidos],
  );
  const ativos = alertas.filter(a => !a.reconhecido);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Monitorar" titulo="Riscos e Alertas" subtitulo="Alertas gerados automaticamente pelas regras de governança; não dependem de cadastro manual." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {NIVEIS.map(n => (
          <KpiCard
            key={n}
            rotulo={NIVEL_ALERTA_LABEL[n]}
            valor={ativos.filter(a => a.nivel === n).length}
            tom={n === 'CRITICO' ? 'vermelho' : n === 'ALERTA' ? 'laranja' : n === 'ATENCAO' ? 'amarelo' : 'azul'}
            onClick={() => setNivel(nivel === n ? '' : n)}
            detalhe={nivel === n ? 'Filtro ativo — clique para limpar' : 'Clique para filtrar'}
          />
        ))}
      </div>

      <Card
        titulo={`Central de Alertas de Governança (${lista.length})`}
        acoes={
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" className="accent-[#1d4e89]" checked={mostrarReconhecidos} onChange={e => setMostrarReconhecidos(e.target.checked)} />
            Mostrar reconhecidos
          </label>
        }
        corpo="p-3"
      >
        {lista.length === 0 ? (
          <Vazio texto="Nenhum alerta para os critérios selecionados." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map(a => (
              <li key={a.chave} className={cx('flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-2 py-3', a.reconhecido && 'opacity-60')}>
                <div className="w-24 shrink-0"><AlertaBadge nivel={a.nivel} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">⚠ {a.titulo}</p>
                  <p className="text-xs text-slate-600">{a.descricao}</p>
                  {a.departamentoId && <p className="text-[11px] text-slate-500 mt-0.5">{ix.departamentos.get(a.departamentoId)?.nome}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {pode('alerta.reconhecer') && !a.reconhecido && (
                    <Botao tamanho="sm" variante="secundario" icone={<CheckCheck className="w-3.5 h-3.5" />} onClick={() => executar(() => reconhecerAlerta(a.chave), 'Alerta reconhecido.')}>Reconhecer</Botao>
                  )}
                  <Botao tamanho="sm" variante="fantasma" icone={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => navegar(a.destino, a.entidade === 'Registro de uso' ? a.registroId : undefined)}>Tratar</Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-500 px-2 pt-2">Reconhecer registra ciência (auditado). O alerta só deixa de existir quando a causa é resolvida.</p>
      </Card>

      <Card titulo="Registro de riscos de IA" subtitulo="Probabilidade × impacto (1–5). Cadastro e matriz completos na próxima etapa." corpo="p-0 pt-3">
        <Tabela
          cabecalho={<>
            <th className={thCls}>Código</th><th className={thCls}>Risco</th><th className={thCls}>Categoria</th>
            <th className={thCls}>P × I</th><th className={thCls}>Nível</th><th className={thCls}>Controles</th><th className={thCls}>Responsável</th><th className={thCls}>Status</th>
          </>}
        >
          {db.riscos.map(r => (
            <tr key={r.id}>
              <td className={cx(tdCls, 'font-mono text-xs font-semibold text-gov-blue')}>{r.codigo}</td>
              <td className={tdCls}><p className="font-medium">{r.titulo}</p><p className="text-xs text-slate-500">{r.descricao}</p></td>
              <td className={cx(tdCls, 'text-xs')}>{r.categoria}</td>
              <td className={cx(tdCls, 'tabular-nums')}>{r.probabilidade} × {r.impacto} = <strong>{r.probabilidade * r.impacto}</strong></td>
              <td className={tdCls}><RiscoBadge nivel={r.nivel} /></td>
              <td className={cx(tdCls, 'text-xs')}>{r.controleIds.map(id => ix.controles.get(id)?.nome).join('; ')}</td>
              <td className={cx(tdCls, 'text-xs')}>{nome(ix, r.responsavelId)}</td>
              <td className={tdCls}><Badge tom={r.status === 'Mitigado' ? 'verde' : r.status === 'Identificado' ? 'laranja' : 'azul'}>{r.status}</Badge></td>
            </tr>
          ))}
        </Tabela>
      </Card>
    </div>
  );
};
