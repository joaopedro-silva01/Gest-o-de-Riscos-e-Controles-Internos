/**
 * ⚠ Riscos e Alertas — pilares MONITORAR e EVOLUIR.
 * - Central de Alertas de Governança (seção 15), derivada das regras.
 * - Registro corporativo de riscos de IA com matriz Probabilidade × Impacto.
 * - Melhorias identificadas (evolução contínua).
 */
import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCheck, Plus } from 'lucide-react';
import { BotaoExcluir, Multiselecao, SelectUsuario, useRascunho } from '../components/forms';
import { AlertaBadge, Badge, Botao, Campo, Card, KpiCard, Modal, PageHeader, RiscoBadge, Tabela, Vazio, cx, inputCls, tdCls, thCls } from '../components/ui';
import { NIVEL_ALERTA_LABEL, NIVEL_RISCO_COR } from '../domain/catalogs';
import type { Melhoria, NivelAlerta, RiscoIA } from '../domain/types';
import { nome } from '../services/derived';
import { nivelMatriz } from '../services/riskEngine';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { formatarData, novoId } from '../utils/dates';

const NIVEIS: NivelAlerta[] = ['CRITICO', 'ALERTA', 'ATENCAO', 'INFORMATIVO'];
const CATEGORIAS: RiscoIA['categoria'][] = ['Segurança da informação', 'Privacidade / LGPD', 'Operacional', 'Regulatório', 'Reputacional'];
const STATUS_RISCO: RiscoIA['status'][] = ['Identificado', 'Em tratamento', 'Mitigado', 'Aceito'];
const ESCALA = [1, 2, 3, 4, 5] as const;
const ROT_PROB = ['Rara', 'Improvável', 'Possível', 'Provável', 'Quase certa'];
const ROT_IMP = ['Insignificante', 'Menor', 'Moderado', 'Maior', 'Catastrófico'];

type Aba = 'alertas' | 'riscos' | 'melhorias';

export const RiscosAlertasPage: React.FC = () => {
  const { alertas, pode } = useGovernanca();
  const [aba, setAba] = useState<Aba>('alertas');
  const ativos = alertas.filter(a => !a.reconhecido);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Monitorar · Evoluir" titulo="Riscos e Alertas" subtitulo="Alertas gerados automaticamente pelas regras de governança, registro de riscos de IA e melhorias." />
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto" role="tablist">
        {([['alertas', `Central de Alertas (${ativos.length})`], ['riscos', 'Registro e matriz de riscos'], ['melhorias', 'Melhorias (Evoluir)']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cx('px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap', aba === k ? 'border-gov-gold text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-800')}>{l}</button>
        ))}
      </div>
      {aba === 'alertas' && <CentralAlertas />}
      {aba === 'riscos' && <RegistroRiscos />}
      {aba === 'melhorias' && <Melhorias />}
      {!pode('risco.gerenciar') && aba !== 'alertas' && <p className="text-xs text-slate-500">Somente leitura para o seu perfil.</p>}
    </div>
  );
};

const CentralAlertas: React.FC = () => {
  const { alertas, navegar, pode, reconhecerAlerta, ix, db } = useGovernanca();
  const executar = useAcao();
  const [nivel, setNivel] = useState<NivelAlerta | ''>('');
  const [mostrarReconhecidos, setMostrarReconhecidos] = useState(false);
  const lista = useMemo(() => alertas.filter(a => (!nivel || a.nivel === nivel) && (mostrarReconhecidos || !a.reconhecido)), [alertas, nivel, mostrarReconhecidos]);
  const ativos = alertas.filter(a => !a.reconhecido);
  const estado = new Map(db.alertasEstado.map(e => [e.chave, e]));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {NIVEIS.map(n => (
          <KpiCard key={n} rotulo={NIVEL_ALERTA_LABEL[n]} valor={ativos.filter(a => a.nivel === n).length}
            tom={n === 'CRITICO' ? 'vermelho' : n === 'ALERTA' ? 'laranja' : n === 'ATENCAO' ? 'amarelo' : 'azul'}
            onClick={() => setNivel(nivel === n ? '' : n)} detalhe={nivel === n ? 'Filtro ativo — clique para limpar' : 'Clique para filtrar'} />
        ))}
      </div>
      <Card
        titulo={`Alertas de Governança (${lista.length})`}
        acoes={<label className="flex items-center gap-2 text-xs text-slate-600"><input id="al-rec" type="checkbox" className="accent-[#1d4e89]" checked={mostrarReconhecidos} onChange={e => setMostrarReconhecidos(e.target.checked)} />Mostrar reconhecidos</label>}
        corpo="p-3"
      >
        {lista.length === 0 ? <Vazio texto="Nenhum alerta para os critérios selecionados." /> : (
          <ul className="divide-y divide-slate-100">
            {lista.map(a => {
              const est = estado.get(a.chave);
              return (
                <li key={a.chave} className={cx('flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-2 py-3', a.reconhecido && 'opacity-60')}>
                  <div className="w-24 shrink-0"><AlertaBadge nivel={a.nivel} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">⚠ {a.titulo}</p>
                    <p className="text-xs text-slate-600">{a.descricao}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {a.departamentoId && ix.departamentos.get(a.departamentoId)?.nome}
                      {est && ` · reconhecido por ${nome(ix, est.reconhecidoPorId)} em ${formatarData(est.reconhecidoEm)}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {pode('alerta.reconhecer') && !a.reconhecido && (
                      <Botao tamanho="sm" variante="secundario" icone={<CheckCheck className="w-3.5 h-3.5" />} onClick={() => executar(() => reconhecerAlerta(a.chave), 'Alerta reconhecido.')}>Reconhecer</Botao>
                    )}
                    <Botao tamanho="sm" variante="fantasma" icone={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => navegar(a.destino, a.entidade === 'Registro de uso' ? a.registroId : undefined)}>Tratar</Botao>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-slate-500 px-2 pt-2">Reconhecer registra ciência (auditado). O alerta só deixa de existir quando a causa é resolvida.</p>
      </Card>
    </>
  );
};

const RegistroRiscos: React.FC = () => {
  const { db, ix, pode, salvar, excluir } = useGovernanca();
  const executar = useAcao();
  const { rascunho, setRascunho, set } = useRascunho<RiscoIA>(null);
  const [celula, setCelula] = useState<{ p: number; i: number } | null>(null);
  const gerencia = pode('risco.gerenciar');

  const lista = db.riscos.filter(r => !celula || (r.probabilidade === celula.p && r.impacto === celula.i));

  const salvarRisco = () => {
    if (!rascunho) return;
    if (!rascunho.titulo.trim()) return executar(() => { throw new Error('Informe o título do risco.'); });
    const item = { ...rascunho, nivel: nivelMatriz(rascunho.probabilidade, rascunho.impacto) };
    if (executar(() => salvar('riscos', item, 'Risco', `${item.codigo} — ${item.titulo}`, 'risco.gerenciar'), 'Risco salvo.')) setRascunho(null);
  };

  const novo = (): RiscoIA => {
    const seq = db.riscos.reduce((m, r) => Math.max(m, Number(r.codigo.replace(/\D/g, '')) || 0), 0) + 1;
    return { id: novoId('rsk'), codigo: `RIA-${String(seq).padStart(2, '0')}`, titulo: '', descricao: '', categoria: 'Segurança da informação', probabilidade: 3, impacto: 3, nivel: 'MEDIO', controleIds: [], ferramentaIds: [], status: 'Identificado' };
  };

  return (
    <div className="grid gap-4">
      <Card titulo="Matriz Probabilidade × Impacto" subtitulo="Clique numa célula para filtrar a lista">
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl table-fixed border-separate border-spacing-1 text-xs min-w-[520px]">
            <colgroup><col className="w-28" />{ESCALA.map(i => <col key={i} />)}</colgroup>
            <tbody>
              {[...ESCALA].reverse().map(p => (
                <tr key={p}>
                  <th scope="row" className="text-right pr-1 font-semibold text-slate-600 whitespace-nowrap w-24">{p} · {ROT_PROB[p - 1]}</th>
                  {ESCALA.map(i => {
                    const nv = nivelMatriz(p, i);
                    const n = db.riscos.filter(r => r.probabilidade === p && r.impacto === i);
                    const ativo = celula?.p === p && celula?.i === i;
                    return (
                      <td key={i} className="p-0">
                        <button
                          onClick={() => setCelula(ativo ? null : { p, i })}
                          title={`P${p} × I${i} = ${p * i}`}
                          className={cx('w-full h-12 rounded-md flex flex-col items-center justify-center text-white font-bold transition-all', ativo && 'ring-2 ring-offset-1 ring-gov-navy', n.length ? 'opacity-100' : 'opacity-35')}
                          style={{ background: NIVEL_RISCO_COR[nv] }}
                        >
                          {n.length > 0 && <span className="text-[10px] leading-tight">{n.map(r => r.codigo).join(' ')}</span>}
                          <span className="text-[9px] font-normal opacity-90">{p * i}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {ESCALA.map(i => <th key={i} scope="col" className="font-semibold text-slate-600 pt-1 text-center">{i}<br /><span className="font-normal">{ROT_IMP[i - 1]}</span></th>)}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Faixas (P × I): Baixo 1–4 · Médio 5–11 · Alto 12–19 · Crítico 20–25. Eixo vertical: probabilidade; horizontal: impacto.</p>
      </Card>

      <Card titulo={`Registro de riscos de IA (${lista.length})`} subtitulo={celula ? `Filtrado: P${celula.p} × I${celula.i}` : undefined} corpo="p-0 pt-3"
        acoes={gerencia && <Botao tamanho="sm" variante="dourado" icone={<Plus className="w-3.5 h-3.5" />} onClick={() => setRascunho(novo())}>Novo risco</Botao>}>
        {lista.length === 0 ? <Vazio texto="Nenhum risco nesta célula." /> : (
          <Tabela minWidth={720} cabecalho={<>
            <th className={thCls}>Código</th><th className={thCls}>Risco</th><th className={thCls}>P × I</th><th className={thCls}>Nível</th><th className={thCls}>Responsável</th><th className={thCls}>Status</th>
          </>}>
            {lista.map(r => (
              <tr key={r.id} className={cx(gerencia && 'hover:bg-gov-light/40 cursor-pointer')} onClick={() => gerencia && setRascunho({ ...r })}>
                <td className={cx(tdCls, 'font-mono text-xs font-semibold text-gov-blue')}>{r.codigo}</td>
                <td className={tdCls}>
                  <p className="font-medium">{r.titulo}</p>
                  <p className="text-xs text-slate-500">{r.categoria} · Controles: {r.controleIds.map(id => ix.controles.get(id)?.nome).join('; ') || 'nenhum'}</p>
                </td>
                <td className={cx(tdCls, 'tabular-nums whitespace-nowrap')}>{r.probabilidade} × {r.impacto} = <strong>{r.probabilidade * r.impacto}</strong></td>
                <td className={tdCls}><RiscoBadge nivel={r.nivel} /></td>
                <td className={cx(tdCls, 'text-xs')}>{nome(ix, r.responsavelId)}</td>
                <td className={tdCls}><Badge tom={r.status === 'Mitigado' ? 'verde' : r.status === 'Identificado' ? 'laranja' : r.status === 'Aceito' ? 'neutro' : 'azul'}>{r.status}</Badge></td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>

      {rascunho && (
        <Modal aberto largura="lg" onFechar={() => setRascunho(null)} titulo={db.riscos.some(x => x.id === rascunho.id) ? `Editar ${rascunho.codigo}` : 'Novo risco de IA'}
          rodape={<>
            {db.riscos.some(x => x.id === rascunho.id) && <BotaoExcluir onConfirmar={() => executar(() => excluir('riscos', rascunho.id, 'Risco', rascunho.codigo, 'risco.gerenciar'), 'Risco excluído.') && setRascunho(null)} />}
            <Botao variante="secundario" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={salvarRisco}>Salvar</Botao>
          </>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo rotulo="Título" obrigatorio className="sm:col-span-2"><input id="rk-tit" className={inputCls} value={rascunho.titulo} onChange={e => set('titulo', e.target.value)} /></Campo>
            <Campo rotulo="Descrição" className="sm:col-span-2"><textarea id="rk-desc" className={inputCls} rows={2} value={rascunho.descricao} onChange={e => set('descricao', e.target.value)} /></Campo>
            <Campo rotulo="Categoria"><select id="rk-cat" className={inputCls} value={rascunho.categoria} onChange={e => set('categoria', e.target.value as RiscoIA['categoria'])}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></Campo>
            <Campo rotulo="Status"><select id="rk-st" className={inputCls} value={rascunho.status} onChange={e => set('status', e.target.value as RiscoIA['status'])}>{STATUS_RISCO.map(c => <option key={c}>{c}</option>)}</select></Campo>
            <Campo rotulo="Probabilidade (1–5)"><select id="rk-p" className={inputCls} value={rascunho.probabilidade} onChange={e => set('probabilidade', Number(e.target.value) as RiscoIA['probabilidade'])}>{ESCALA.map(n => <option key={n} value={n}>{n} — {ROT_PROB[n - 1]}</option>)}</select></Campo>
            <Campo rotulo="Impacto (1–5)"><select id="rk-i" className={inputCls} value={rascunho.impacto} onChange={e => set('impacto', Number(e.target.value) as RiscoIA['impacto'])}>{ESCALA.map(n => <option key={n} value={n}>{n} — {ROT_IMP[n - 1]}</option>)}</select></Campo>
            <div className="sm:col-span-2 text-sm flex items-center gap-2">Nível calculado: <RiscoBadge nivel={nivelMatriz(rascunho.probabilidade, rascunho.impacto)} /> <span className="text-xs text-slate-500">({rascunho.probabilidade} × {rascunho.impacto} = {rascunho.probabilidade * rascunho.impacto})</span></div>
            <Campo rotulo="Responsável"><SelectUsuario id="rk-resp" usuarios={db.usuarios} valor={rascunho.responsavelId} onChange={v => set('responsavelId', v)} /></Campo>
            <div />
            <Campo rotulo="Controles mitigadores"><Multiselecao opcoes={db.controles.map(c => ({ id: c.id, rotulo: c.nome, detalhe: c.tipo }))} valor={rascunho.controleIds} onChange={v => set('controleIds', v)} /></Campo>
            <Campo rotulo="Ferramentas relacionadas"><Multiselecao opcoes={db.ferramentas.map(f => ({ id: f.id, rotulo: f.nome }))} valor={rascunho.ferramentaIds} onChange={v => set('ferramentaIds', v)} /></Campo>
          </div>
        </Modal>
      )}
    </div>
  );
};

const ORIGENS: Melhoria['origem'][] = ['Incidente', 'Auditoria', 'Revisão', 'Sugestão'];
const STATUS_MEL: Melhoria['status'][] = ['Identificada', 'Em implantação', 'Implantada'];

const Melhorias: React.FC = () => {
  const { db, ix, pode, salvar, excluir, hoje, usuario } = useGovernanca();
  const executar = useAcao();
  const { rascunho, setRascunho, set } = useRascunho<Melhoria>(null);
  const gerencia = pode('risco.gerenciar');

  const salvarMelhoria = () => {
    if (!rascunho?.titulo.trim()) return executar(() => { throw new Error('Informe o título da melhoria.'); });
    if (executar(() => salvar('melhorias', rascunho, 'Melhoria', rascunho.titulo, 'risco.gerenciar'), 'Melhoria salva.')) setRascunho(null);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {STATUS_MEL.map(s => <KpiCard key={s} rotulo={s} valor={db.melhorias.filter(m => m.status === s).length} tom={s === 'Implantada' ? 'verde' : s === 'Em implantação' ? 'azul' : 'dourado'} />)}
      </div>
      <Card titulo="Melhorias identificadas" subtitulo="Lições de incidentes, auditorias e revisões que tornam a governança mais madura" corpo="p-0 pt-3"
        acoes={gerencia && <Botao tamanho="sm" variante="dourado" icone={<Plus className="w-3.5 h-3.5" />} onClick={() => setRascunho({ id: novoId('mel'), titulo: '', descricao: '', origem: 'Revisão', status: 'Identificada', responsavelId: usuario.id, data: hoje })}>Nova melhoria</Botao>}>
        {db.melhorias.length === 0 ? <Vazio texto="Nenhuma melhoria registrada." /> : (
          <Tabela minWidth={640} cabecalho={<><th className={thCls}>Melhoria</th><th className={thCls}>Origem</th><th className={thCls}>Responsável</th><th className={thCls}>Data</th><th className={thCls}>Status</th></>}>
            {db.melhorias.map(m => (
              <tr key={m.id} className={cx(gerencia && 'hover:bg-gov-light/40 cursor-pointer')} onClick={() => gerencia && setRascunho({ ...m })}>
                <td className={tdCls}><p className="font-medium">{m.titulo}</p><p className="text-xs text-slate-500">{m.descricao}</p></td>
                <td className={cx(tdCls, 'text-xs')}>{m.origem}</td>
                <td className={cx(tdCls, 'text-xs')}>{nome(ix, m.responsavelId)}</td>
                <td className={cx(tdCls, 'text-xs')}>{formatarData(m.data)}</td>
                <td className={tdCls}><Badge tom={m.status === 'Implantada' ? 'verde' : m.status === 'Em implantação' ? 'azul' : 'dourado'}>{m.status}</Badge></td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>
      {rascunho && (
        <Modal aberto largura="md" onFechar={() => setRascunho(null)} titulo={db.melhorias.some(x => x.id === rascunho.id) ? 'Editar melhoria' : 'Nova melhoria'}
          rodape={<>
            {db.melhorias.some(x => x.id === rascunho.id) && <BotaoExcluir onConfirmar={() => executar(() => excluir('melhorias', rascunho.id, 'Melhoria', rascunho.titulo, 'risco.gerenciar'), 'Melhoria excluída.') && setRascunho(null)} />}
            <Botao variante="secundario" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={salvarMelhoria}>Salvar</Botao>
          </>}>
          <div className="grid gap-4">
            <Campo rotulo="Título" obrigatorio><input id="mel-tit" className={inputCls} value={rascunho.titulo} onChange={e => set('titulo', e.target.value)} /></Campo>
            <Campo rotulo="Descrição"><textarea id="mel-desc" className={inputCls} rows={2} value={rascunho.descricao} onChange={e => set('descricao', e.target.value)} /></Campo>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo rotulo="Origem"><select id="mel-or" className={inputCls} value={rascunho.origem} onChange={e => set('origem', e.target.value as Melhoria['origem'])}>{ORIGENS.map(o => <option key={o}>{o}</option>)}</select></Campo>
              <Campo rotulo="Status"><select id="mel-st" className={inputCls} value={rascunho.status} onChange={e => set('status', e.target.value as Melhoria['status'])}>{STATUS_MEL.map(o => <option key={o}>{o}</option>)}</select></Campo>
              <Campo rotulo="Responsável"><SelectUsuario id="mel-resp" usuarios={db.usuarios} valor={rascunho.responsavelId} onChange={v => set('responsavelId', v)} /></Campo>
              <Campo rotulo="Data"><input id="mel-dt" type="date" className={inputCls} value={rascunho.data} onChange={e => set('data', e.target.value)} /></Campo>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
