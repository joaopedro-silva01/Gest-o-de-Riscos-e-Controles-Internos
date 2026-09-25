/**
 * 🚨 Incidentes de IA (seção 14).
 * Qualquer perfil com 'incidente.registrar' comunica; o tratamento exige 'incidente.tratar'.
 * Aberto → Em análise → Em tratamento → Resolvido → Encerrado.
 */
import React, { useMemo, useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { BotaoExcluir, SelectUsuario, useRascunho } from '../components/forms';
import { Badge, Botao, Campo, Card, KpiCard, Modal, PageHeader, RiscoBadge, Tabela, Vazio, cx, inputCls, tdCls, thCls } from '../components/ui';
import { NIVEIS_RISCO, NIVEL_RISCO_LABEL, STATUS_INCIDENTE, STATUS_INCIDENTE_ABERTO, TIPOS_INCIDENTE } from '../domain/catalogs';
import type { Incidente, NivelRisco, StatusIncidente, TipoIncidente } from '../domain/types';
import { departamentoDoIncidente, nome } from '../services/derived';
import { exportarCsv } from '../services/export';
import { escopoDe } from '../services/permissions';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { diasEntre, formatarData, novoId } from '../utils/dates';

const TOM_STATUS: Record<StatusIncidente, 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'neutro'> = {
  Aberto: 'vermelho', 'Em análise': 'laranja', 'Em tratamento': 'amarelo', Resolvido: 'verde', Encerrado: 'neutro',
};

export const IncidentesPage: React.FC = () => {
  const { db, ix, incidentesEscopo, registros, usuariosEscopo, pode, salvar, excluir, usuario, hoje } = useGovernanca();
  const executar = useAcao();
  const [status, setStatus] = useState('');
  const [tipo, setTipo] = useState('');
  const { rascunho, setRascunho, set } = useRascunho<Incidente>(null);
  const trata = pode('incidente.tratar');

  const lista = useMemo(() => incidentesEscopo
    .filter(i => (!status || i.status === status) && (!tipo || i.tipo === tipo))
    .sort((a, b) => b.data.localeCompare(a.data)), [incidentesEscopo, status, tipo]);

  const abertos = incidentesEscopo.filter(i => STATUS_INCIDENTE_ABERTO.includes(i.status));
  const encerrados = incidentesEscopo.filter(i => i.dataEncerramento);
  const mttr = encerrados.length ? Math.round(encerrados.reduce((s, i) => s + diasEntre(i.data, i.dataEncerramento!), 0) / encerrados.length) : 0;
  const existente = rascunho && db.incidentes.some(x => x.id === rascunho.id);
  // Quem só registra pode editar enquanto o incidente não foi assumido pelo tratamento.
  const somenteComunicar = !trata;

  const novo = (): Incidente => {
    const seq = db.incidentes.reduce((m, i) => Math.max(m, Number(i.codigo.replace(/\D/g, '')) || 0), 0) + 1;
    return {
      id: novoId('inc'), codigo: `INC-${String(seq).padStart(3, '0')}`, data: hoje, colaboradorId: escopoDe(usuario) === 'PROPRIO' ? usuario.id : undefined,
      tipo: 'Uso indevido', descricao: '', dadosEnvolvidos: '', impacto: 'MEDIO', risco: 'MEDIO', acaoTomada: '', status: 'Aberto',
    };
  };

  const salvarIncidente = () => {
    if (!rascunho) return;
    if (!rascunho.descricao.trim()) return executar(() => { throw new Error('Descreva o incidente.'); });
    const fechado = rascunho.status === 'Resolvido' || rascunho.status === 'Encerrado';
    if (fechado && !rascunho.acaoTomada.trim()) return executar(() => { throw new Error('Informe a ação tomada antes de resolver ou encerrar.'); });
    const item = { ...rascunho, dataEncerramento: fechado ? rascunho.dataEncerramento ?? hoje : undefined };
    const perm = existente ? 'incidente.tratar' : 'incidente.registrar';
    if (executar(() => salvar('incidentes', item, 'Incidente', `${item.codigo} — ${item.tipo}`, perm), existente ? 'Incidente atualizado.' : 'Incidente registrado. A equipe de Governança foi sinalizada.')) setRascunho(null);
  };

  const exportar = () => exportarCsv<Incidente>(lista, [
    { titulo: 'ID', valor: i => i.codigo }, { titulo: 'Data', valor: i => i.data }, { titulo: 'Colaborador', valor: i => nome(ix, i.colaboradorId) },
    { titulo: 'Departamento', valor: i => ix.departamentos.get(departamentoDoIncidente(ix, i) ?? '')?.nome }, { titulo: 'Ferramenta', valor: i => ix.ferramentas.get(i.ferramentaId ?? '')?.nome },
    { titulo: 'Tipo', valor: i => i.tipo }, { titulo: 'Descrição', valor: i => i.descricao }, { titulo: 'Dados envolvidos', valor: i => i.dadosEnvolvidos },
    { titulo: 'Impacto', valor: i => NIVEL_RISCO_LABEL[i.impacto] }, { titulo: 'Risco', valor: i => NIVEL_RISCO_LABEL[i.risco] }, { titulo: 'Responsável', valor: i => nome(ix, i.responsavelId) },
    { titulo: 'Ação tomada', valor: i => i.acaoTomada }, { titulo: 'Status', valor: i => i.status }, { titulo: 'Encerramento', valor: i => i.dataEncerramento },
  ], `incidentes-ia-${hoje}.csv`);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Monitorar" titulo="Incidentes de IA"
        subtitulo="Comunique qualquer uso indevido, envio de informação não autorizada ou resultado incorreto. Comunicar rápido reduz o impacto."
        acoes={<>
          {pode('relatorio.exportar') && <Botao variante="secundario" icone={<Download className="w-4 h-4" />} onClick={exportar}>Exportar CSV</Botao>}
          {pode('incidente.registrar') && <Botao variante="dourado" icone={<Plus className="w-4 h-4" />} onClick={() => setRascunho(novo())}>Registrar incidente</Botao>}
        </>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard rotulo="Incidentes registrados" valor={incidentesEscopo.length} tom="navy" />
        <KpiCard rotulo="Em aberto" valor={abertos.length} tom="vermelho" onClick={() => setStatus('')} />
        <KpiCard rotulo="Alto impacto em aberto" valor={abertos.filter(i => i.impacto === 'ALTO' || i.impacto === 'CRITICO').length} tom="laranja" />
        <KpiCard rotulo="Tempo médio de resolução" valor={`${mttr}d`} detalhe="Da abertura ao encerramento" tom="azul" />
      </div>

      <Card corpo="p-0">
        <div className="grid sm:grid-cols-2 gap-3 p-4 max-w-2xl">
          <select id="inc-f-st" className={inputCls} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos os status</option>{STATUS_INCIDENTE.map(s => <option key={s}>{s}</option>)}</select>
          <select id="inc-f-tp" className={inputCls} value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Todos os tipos</option>{TIPOS_INCIDENTE.map(s => <option key={s}>{s}</option>)}</select>
        </div>
        {lista.length === 0 ? <Vazio texto="Nenhum incidente registrado." /> : (
          <Tabela minWidth={1000} cabecalho={<>
            <th className={thCls}>ID</th><th className={thCls}>Data</th><th className={thCls}>Tipo / descrição</th><th className={thCls}>Colaborador / área</th>
            <th className={thCls}>Ferramenta</th><th className={thCls}>Impacto</th><th className={thCls}>Responsável</th><th className={thCls}>Status</th>
          </>}>
            {lista.map(i => (
              <tr key={i.id} className={cx(trata && 'hover:bg-gov-light/40 cursor-pointer')} tabIndex={trata ? 0 : undefined} onClick={() => trata && setRascunho({ ...i })} onKeyDown={e => trata && e.key === 'Enter' && setRascunho({ ...i })}>
                <td className={cx(tdCls, 'font-mono text-xs font-semibold text-gov-blue')}>{i.codigo}</td>
                <td className={cx(tdCls, 'text-xs whitespace-nowrap')}>{formatarData(i.data)}</td>
                <td className={tdCls}><p className="font-medium">{i.tipo}</p><p className="text-xs text-slate-500 line-clamp-2">{i.descricao}</p></td>
                <td className={tdCls}><p>{nome(ix, i.colaboradorId)}</p><p className="text-xs text-slate-500">{ix.departamentos.get(departamentoDoIncidente(ix, i) ?? '')?.nome}</p></td>
                <td className={cx(tdCls, 'text-xs')}>{ix.ferramentas.get(i.ferramentaId ?? '')?.nome ?? '—'}</td>
                <td className={tdCls}><RiscoBadge nivel={i.impacto} /></td>
                <td className={cx(tdCls, 'text-xs')}>{nome(ix, i.responsavelId)}</td>
                <td className={tdCls}><Badge tom={TOM_STATUS[i.status]}>{i.status}</Badge>{i.dataEncerramento && <p className="text-[10px] text-slate-500 mt-0.5">em {formatarData(i.dataEncerramento)}</p>}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>

      {rascunho && (
        <Modal aberto largura="lg" onFechar={() => setRascunho(null)} titulo={existente ? `${rascunho.codigo} — tratamento` : 'Registrar incidente de IA'}
          subtitulo={existente ? `Aberto em ${formatarData(rascunho.data)}` : 'Descreva o que aconteceu. A equipe de Governança fará a análise.'}
          rodape={<>
            {existente && pode('configuracoes.gerenciar') && <BotaoExcluir onConfirmar={() => executar(() => excluir('incidentes', rascunho.id, 'Incidente', rascunho.codigo, 'configuracoes.gerenciar'), 'Incidente excluído.') && setRascunho(null)} />}
            <Botao variante="secundario" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={salvarIncidente}>{existente ? 'Salvar tratamento' : 'Registrar'}</Botao>
          </>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo rotulo="Data"><input id="inc-dt" type="date" className={inputCls} value={rascunho.data} onChange={e => set('data', e.target.value)} /></Campo>
            <Campo rotulo="Tipo de incidente"><select id="inc-tp" className={inputCls} value={rascunho.tipo} onChange={e => set('tipo', e.target.value as TipoIncidente)}>{TIPOS_INCIDENTE.map(t => <option key={t}>{t}</option>)}</select></Campo>
            <Campo rotulo="Colaborador envolvido">
              <select id="inc-col" className={inputCls} value={rascunho.colaboradorId ?? ''} disabled={somenteComunicar && escopoDe(usuario) === 'PROPRIO'} onChange={e => set('colaboradorId', e.target.value || undefined)}>
                <option value="">Não identificado</option>{(trata ? db.usuarios : usuariosEscopo).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </Campo>
            {!rascunho.colaboradorId ? (
              <Campo rotulo="Departamento"><select id="inc-dep" className={inputCls} value={rascunho.departamentoId ?? ''} onChange={e => set('departamentoId', e.target.value || undefined)}><option value="">Não identificado</option>{db.departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></Campo>
            ) : (
              <Campo rotulo="Departamento"><input id="inc-dep-ro" className={inputCls} disabled value={ix.departamentos.get(ix.usuarios.get(rascunho.colaboradorId)?.departamentoId ?? '')?.nome ?? ''} /></Campo>
            )}
            <Campo rotulo="Ferramenta"><select id="inc-fer" className={inputCls} value={rascunho.ferramentaId ?? ''} onChange={e => set('ferramentaId', e.target.value || undefined)}><option value="">Não identificada</option>{db.ferramentas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></Campo>
            <Campo rotulo="Utilização relacionada (opcional)"><select id="inc-reg" className={inputCls} value={rascunho.registroUsoId ?? ''} onChange={e => set('registroUsoId', e.target.value || undefined)}><option value="">Nenhuma</option>{registros.map(r => <option key={r.id} value={r.id}>{r.codigo} — {r.atividade}</option>)}</select></Campo>
            <Campo rotulo="Descrição" obrigatorio className="sm:col-span-2"><textarea id="inc-desc" className={inputCls} rows={3} value={rascunho.descricao} onChange={e => set('descricao', e.target.value)} /></Campo>
            <Campo rotulo="Dados envolvidos" className="sm:col-span-2"><input id="inc-dados" className={inputCls} value={rascunho.dadosEnvolvidos} onChange={e => set('dadosEnvolvidos', e.target.value)} placeholder="Ex.: nome e CPF de 1 cliente" /></Campo>
            <Campo rotulo="Nível de impacto"><select id="inc-imp" className={inputCls} value={rascunho.impacto} onChange={e => set('impacto', e.target.value as NivelRisco)}>{NIVEIS_RISCO.map(n => <option key={n} value={n}>{NIVEL_RISCO_LABEL[n]}</option>)}</select></Campo>
            {trata && <>
              <Campo rotulo="Risco"><select id="inc-risco" className={inputCls} value={rascunho.risco} onChange={e => set('risco', e.target.value as NivelRisco)}>{NIVEIS_RISCO.map(n => <option key={n} value={n}>{NIVEL_RISCO_LABEL[n]}</option>)}</select></Campo>
              <Campo rotulo="Responsável pelo tratamento"><SelectUsuario id="inc-resp" usuarios={db.usuarios} valor={rascunho.responsavelId} onChange={v => set('responsavelId', v)} /></Campo>
              <Campo rotulo="Status"><select id="inc-st" className={inputCls} value={rascunho.status} onChange={e => set('status', e.target.value as StatusIncidente)}>{STATUS_INCIDENTE.map(s => <option key={s}>{s}</option>)}</select></Campo>
              <Campo rotulo="Ação tomada" className="sm:col-span-2" ajuda="Obrigatória para resolver ou encerrar."><textarea id="inc-acao" className={inputCls} rows={2} value={rascunho.acaoTomada} onChange={e => set('acaoTomada', e.target.value)} /></Campo>
              {(rascunho.status === 'Resolvido' || rascunho.status === 'Encerrado') && (
                <Campo rotulo="Data de encerramento"><input id="inc-enc" type="date" className={inputCls} value={rascunho.dataEncerramento ?? hoje} onChange={e => set('dataEncerramento', e.target.value)} /></Campo>
              )}
            </>}
          </div>
        </Modal>
      )}
    </div>
  );
};
