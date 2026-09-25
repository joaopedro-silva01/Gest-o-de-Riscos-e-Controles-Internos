/**
 * 🎓 Capacitação em IA (seção 13) — pilar ORIENTAR.
 * Indicadores de % treinados / pendentes / vencidos, situação individual,
 * registro de participação e catálogo de treinamentos.
 */
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { BotaoExcluir, useRascunho } from '../components/forms';
import { Badge, Botao, Campo, Card, KpiCard, Modal, PageHeader, SimNao, Tabela, Vazio, cx, inputCls, tdCls, thCls } from '../components/ui';
import type { Participacao, StatusTreinamento, Treinamento } from '../domain/types';
import { situacaoTreinamento, statusParticipacao, SituacaoTreinamento, usuariosDeIA } from '../services/derived';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { addMeses, formatarData, novoId } from '../utils/dates';

const TOM: Record<StatusTreinamento, 'verde' | 'azul' | 'laranja' | 'amarelo'> = { Concluído: 'verde', 'Em andamento': 'azul', Pendente: 'laranja', Vencido: 'amarelo' };
const TOM_SIT: Record<SituacaoTreinamento, 'verde' | 'laranja' | 'amarelo'> = { Treinado: 'verde', Pendente: 'laranja', Vencido: 'amarelo' };

export const TreinamentosPage: React.FC = () => {
  const { db, ix, usuariosEscopo, registros, pode, salvar, excluir, hoje } = useGovernanca();
  const executar = useAcao();
  const [publico, setPublico] = useState<'ia' | 'todos'>('ia');
  const [aba, setAba] = useState<'situacao' | 'participacoes' | 'catalogo'>('situacao');
  const part = useRascunho<Participacao>(null);
  const trn = useRascunho<Treinamento>(null);
  const gerencia = pode('treinamento.gerenciar');

  const pessoas = useMemo(() => {
    const ia = new Set(usuariosDeIA(db, registros).map(u => u.id));
    return usuariosEscopo.filter(u => u.ativo && (publico === 'todos' || ia.has(u.id)));
  }, [db, registros, usuariosEscopo, publico]);
  const sit = pessoas.map(u => situacaoTreinamento(db, u, hoje));
  const pct = (s: SituacaoTreinamento) => (pessoas.length ? Math.round((sit.filter(x => x === s).length / pessoas.length) * 100) : 0);
  const obrigatorios = db.treinamentos.filter(t => t.obrigatorio);
  const participacoes = db.participacoes.filter(p => usuariosEscopo.some(u => u.id === p.colaboradorId));

  const salvarParticipacao = () => {
    const p = part.rascunho;
    if (!p) return;
    if (!p.colaboradorId || !p.treinamentoId) return executar(() => { throw new Error('Selecione colaborador e treinamento.'); });
    if (p.status === 'Concluído' && !p.data) return executar(() => { throw new Error('Informe a data de conclusão.'); });
    const t = ix.treinamentos.get(p.treinamentoId)!;
    // Reciclagem calculada pela validade do treinamento (editável).
    const item: Participacao = { ...p, proximaReciclagem: p.status === 'Concluído' && p.data ? p.proximaReciclagem || addMeses(p.data, t.validadeMeses) : undefined };
    const rot = `${ix.usuarios.get(p.colaboradorId)?.nome} — ${t.titulo}`;
    if (executar(() => salvar('participacoes', item, 'Participação', rot, 'treinamento.gerenciar'), 'Participação registrada.')) part.setRascunho(null);
  };

  const salvarTreinamento = () => {
    const t = trn.rascunho;
    if (!t?.titulo.trim()) return executar(() => { throw new Error('Informe o título.'); });
    if (executar(() => salvar('treinamentos', t, 'Treinamento', t.titulo, 'treinamento.gerenciar'), 'Treinamento salvo.')) trn.setRascunho(null);
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Orientar" titulo="Capacitação em IA" subtitulo="Ninguém deve usar IA com dados corporativos sem os treinamentos obrigatórios em dia."
        acoes={gerencia && <>
          <Botao variante="secundario" icone={<Plus className="w-4 h-4" />} onClick={() => trn.setRascunho({ id: novoId('trn'), titulo: '', descricao: '', obrigatorio: false, cargaHoraria: 1, validadeMeses: 12 })}>Novo treinamento</Botao>
          <Botao variante="dourado" icone={<Plus className="w-4 h-4" />} onClick={() => part.setRascunho({ id: novoId('par'), treinamentoId: obrigatorios[0]?.id ?? '', colaboradorId: '', status: 'Concluído', data: hoje, certificado: true })}>Registrar participação</Botao>
        </>}
      />

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">Público:</span>
        {([['ia', 'Colaboradores que usam IA'], ['todos', 'Todos os colaboradores']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPublico(k)} className={cx('px-3 py-1 rounded-full text-xs font-semibold border', publico === k ? 'bg-gov-navy text-white border-gov-navy' : 'bg-white text-slate-600 border-slate-300')}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard rotulo="Colaboradores no público" valor={pessoas.length} tom="navy" />
        <KpiCard rotulo="% treinados" valor={`${pct('Treinado')}%`} detalhe={`${sit.filter(s => s === 'Treinado').length} pessoas`} tom="verde" />
        <KpiCard rotulo="% pendentes" valor={`${pct('Pendente')}%`} detalhe={`${sit.filter(s => s === 'Pendente').length} pessoas`} tom="laranja" />
        <KpiCard rotulo="% com treinamento vencido" valor={`${pct('Vencido')}%`} detalhe={`${sit.filter(s => s === 'Vencido').length} pessoas`} tom="amarelo" />
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto" role="tablist">
        {([['situacao', 'Situação por colaborador'], ['participacoes', 'Participações'], ['catalogo', 'Catálogo de treinamentos']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cx('px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap', aba === k ? 'border-gov-gold text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-800')}>{l}</button>
        ))}
      </div>

      {aba === 'situacao' && (
        <Card corpo="p-0 pt-2" titulo="Treinamentos obrigatórios por colaborador">
          {pessoas.length === 0 ? <Vazio texto="Ninguém no público selecionado." /> : (
            <Tabela minWidth={720} cabecalho={<>
              <th className={thCls}>Colaborador</th><th className={thCls}>Área</th>
              {obrigatorios.map(t => <th key={t.id} className={thCls}>{t.titulo}</th>)}
              <th className={thCls}>Situação</th>
            </>}>
              {pessoas.map((u, idx) => (
                <tr key={u.id}>
                  <td className={tdCls}><p className="font-medium">{u.nome}</p><p className="text-xs text-slate-500">{u.cargo}</p></td>
                  <td className={cx(tdCls, 'text-xs')}>{ix.departamentos.get(u.departamentoId)?.nome}</td>
                  {obrigatorios.map(t => {
                    const p = db.participacoes.find(x => x.colaboradorId === u.id && x.treinamentoId === t.id);
                    const st: StatusTreinamento = p ? statusParticipacao(p, hoje) : 'Pendente';
                    return (
                      <td key={t.id} className={tdCls}>
                        <Badge tom={TOM[st]}>{st}</Badge>
                        {p?.proximaReciclagem && <p className="text-[10px] text-slate-500 mt-0.5">Reciclagem: {formatarData(p.proximaReciclagem)}</p>}
                      </td>
                    );
                  })}
                  <td className={tdCls}><Badge tom={TOM_SIT[sit[idx]]}>{sit[idx]}</Badge></td>
                </tr>
              ))}
            </Tabela>
          )}
        </Card>
      )}

      {aba === 'participacoes' && (
        <Card corpo="p-0 pt-2" titulo="Registro de participações">
          <Tabela minWidth={820} cabecalho={<>
            <th className={thCls}>Colaborador</th><th className={thCls}>Treinamento</th><th className={thCls}>Data</th><th className={thCls}>Status</th>
            <th className={thCls}>Certificação</th><th className={thCls}>Próxima reciclagem</th>
          </>}>
            {participacoes.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '')).map(p => {
              const st = statusParticipacao(p, hoje);
              return (
                <tr key={p.id} className={cx(gerencia && 'hover:bg-gov-light/40 cursor-pointer')} onClick={() => gerencia && part.setRascunho({ ...p })}>
                  <td className={tdCls}>{ix.usuarios.get(p.colaboradorId)?.nome}</td>
                  <td className={tdCls}>{ix.treinamentos.get(p.treinamentoId)?.titulo}</td>
                  <td className={cx(tdCls, 'text-xs')}>{formatarData(p.data)}</td>
                  <td className={tdCls}><Badge tom={TOM[st]}>{st}</Badge></td>
                  <td className={cx(tdCls, 'text-xs')}>{p.certificado ? 'Emitida' : '—'}</td>
                  <td className={cx(tdCls, 'text-xs', st === 'Vencido' && 'text-amber-800 font-semibold')}>{formatarData(p.proximaReciclagem)}</td>
                </tr>
              );
            })}
          </Tabela>
        </Card>
      )}

      {aba === 'catalogo' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {db.treinamentos.map(t => {
            const ps = db.participacoes.filter(p => p.treinamentoId === t.id);
            return (
              <Card key={t.id} titulo={t.titulo} subtitulo={`${t.cargaHoraria}h · validade de ${t.validadeMeses} meses`}
                acoes={t.obrigatorio ? <Badge tom="vermelho">Obrigatório</Badge> : <Badge>Complementar</Badge>}>
                <p className="text-sm text-slate-600">{t.descricao}</p>
                <p className="text-xs text-slate-500 mt-2">{ps.filter(p => statusParticipacao(p, hoje) === 'Concluído').length} concluídos · {ps.filter(p => statusParticipacao(p, hoje) === 'Vencido').length} vencidos · {ps.filter(p => p.status !== 'Concluído').length} em andamento/pendentes</p>
                {gerencia && <Botao className="mt-3" tamanho="sm" variante="secundario" onClick={() => trn.setRascunho({ ...t })}>Editar</Botao>}
              </Card>
            );
          })}
        </div>
      )}

      {part.rascunho && (
        <Modal aberto largura="md" onFechar={() => part.setRascunho(null)} titulo={db.participacoes.some(x => x.id === part.rascunho!.id) ? 'Editar participação' : 'Registrar participação'}
          rodape={<>
            {db.participacoes.some(x => x.id === part.rascunho!.id) && <BotaoExcluir onConfirmar={() => executar(() => excluir('participacoes', part.rascunho!.id, 'Participação', part.rascunho!.id, 'treinamento.gerenciar'), 'Participação excluída.') && part.setRascunho(null)} />}
            <Botao variante="secundario" onClick={() => part.setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={salvarParticipacao}>Salvar</Botao>
          </>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo rotulo="Colaborador" obrigatorio><select id="par-col" className={inputCls} value={part.rascunho.colaboradorId} onChange={e => part.set('colaboradorId', e.target.value)}><option value="">Selecione…</option>{usuariosEscopo.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Campo>
            <Campo rotulo="Treinamento" obrigatorio><select id="par-trn" className={inputCls} value={part.rascunho.treinamentoId} onChange={e => part.set('treinamentoId', e.target.value)}>{db.treinamentos.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}</select></Campo>
            <Campo rotulo="Status"><select id="par-st" className={inputCls} value={part.rascunho.status} onChange={e => part.set('status', e.target.value as Participacao['status'])}>{(['Concluído', 'Em andamento', 'Pendente'] as const).map(s => <option key={s}>{s}</option>)}</select></Campo>
            <Campo rotulo="Data"><input id="par-dt" type="date" className={inputCls} value={part.rascunho.data ?? ''} onChange={e => { part.set('data', e.target.value || undefined); part.set('proximaReciclagem', undefined); }} /></Campo>
            <Campo rotulo="Próxima reciclagem" ajuda="Em branco = data + validade do treinamento."><input id="par-rec" type="date" className={inputCls} value={part.rascunho.proximaReciclagem ?? ''} onChange={e => part.set('proximaReciclagem', e.target.value || undefined)} /></Campo>
            <div className="self-end"><SimNao pergunta="Certificado emitido?" valor={part.rascunho.certificado} onChange={v => part.set('certificado', v)} /></div>
          </div>
        </Modal>
      )}

      {trn.rascunho && (
        <Modal aberto largura="md" onFechar={() => trn.setRascunho(null)} titulo={db.treinamentos.some(x => x.id === trn.rascunho!.id) ? 'Editar treinamento' : 'Novo treinamento'}
          rodape={<>
            {db.treinamentos.some(x => x.id === trn.rascunho!.id) && (
              <BotaoExcluir bloqueio={db.participacoes.some(p => p.treinamentoId === trn.rascunho!.id) ? 'há participações registradas' : undefined}
                onConfirmar={() => executar(() => excluir('treinamentos', trn.rascunho!.id, 'Treinamento', trn.rascunho!.titulo, 'treinamento.gerenciar'), 'Treinamento excluído.') && trn.setRascunho(null)} />
            )}
            <Botao variante="secundario" onClick={() => trn.setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={salvarTreinamento}>Salvar</Botao>
          </>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo rotulo="Título" obrigatorio className="sm:col-span-2"><input id="trn-tit" className={inputCls} value={trn.rascunho.titulo} onChange={e => trn.set('titulo', e.target.value)} /></Campo>
            <Campo rotulo="Descrição" className="sm:col-span-2"><textarea id="trn-desc" className={inputCls} rows={2} value={trn.rascunho.descricao} onChange={e => trn.set('descricao', e.target.value)} /></Campo>
            <Campo rotulo="Carga horária (h)"><input id="trn-ch" type="number" min={1} className={inputCls} value={trn.rascunho.cargaHoraria} onChange={e => trn.set('cargaHoraria', Number(e.target.value))} /></Campo>
            <Campo rotulo="Validade (meses)" ajuda="Define a reciclagem."><input id="trn-val" type="number" min={1} className={inputCls} value={trn.rascunho.validadeMeses} onChange={e => trn.set('validadeMeses', Number(e.target.value))} /></Campo>
            <div className="sm:col-span-2"><SimNao pergunta="Obrigatório para quem usa IA?" valor={trn.rascunho.obrigatorio} onChange={v => trn.set('obrigatorio', v)} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
};
