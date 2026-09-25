/**
 * 📋 Casos de Uso de IA (seção 9) — biblioteca reutilizável.
 * Um caso de uso é o "modelo" aprovado; cada Registro de Uso é uma instância dele.
 */
import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { BotaoExcluir, Multiselecao, SelectUsuario, useRascunho } from '../components/forms';
import { RegistroDetalhe } from '../components/RegistroDetalhe';
import { RegistrosTabela } from '../components/RegistrosTabela';
import { Badge, Botao, Campo, Card, Info, Modal, PageHeader, RiscoBadge, SimNao, Tabela, Vazio, cx, inputCls, tdCls, thCls } from '../components/ui';
import { NIVEIS_RISCO, NIVEL_RISCO_LABEL, TIPOS_DADO, TIPO_DADO_LABEL } from '../domain/catalogs';
import type { CasoUso, NivelRisco } from '../domain/types';
import { nome } from '../services/derived';
import { escopoDe } from '../services/permissions';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { formatarData, novoId } from '../utils/dates';

const STATUS: CasoUso['status'][] = ['Ativo', 'Em avaliação', 'Descontinuado'];

export const CasosUsoPage: React.FC = () => {
  const { db, ix, registros, pode, salvar, excluir, usuario, hoje } = useGovernanca();
  const executar = useAcao();
  const [busca, setBusca] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);
  const { rascunho, setRascunho, set } = useRascunho<CasoUso>(null);

  // Gestor mantém casos da própria área; Administrador, de todas.
  const podeEditar = (c: CasoUso) => pode('caso_uso.gerenciar') && (escopoDe(usuario) === 'TUDO' || c.departamentoId === usuario.departamentoId);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return db.casosUso.filter(c =>
      (!area || c.departamentoId === area) && (!status || c.status === status) &&
      (!q || [c.nome, c.processo, c.objetivo].some(v => v.toLowerCase().includes(q))));
  }, [db.casosUso, busca, area, status]);

  const instancias = (id: string) => registros.filter(r => r.casoUsoId === id);
  const c = aberto ? ix.casosUso.get(aberto) : undefined;

  const novo = (): CasoUso => ({
    id: novoId('cu'), nome: '', departamentoId: usuario.departamentoId, processo: '', ferramentaIds: [], objetivo: '', beneficioEsperado: '',
    dadosUtilizados: [], nivelRisco: 'BAIXO', status: 'Em avaliação', responsavelId: usuario.id, aprovado: false, controleIds: [], ultimaRevisao: hoje,
  });

  const salvarCaso = () => {
    if (!rascunho) return;
    if (!rascunho.nome.trim() || !rascunho.processo.trim()) return executar(() => { throw new Error('Informe nome e processo.'); });
    if (!rascunho.ferramentaIds.length) return executar(() => { throw new Error('Selecione ao menos uma ferramenta.'); });
    if (executar(() => salvar('casosUso', rascunho, 'Caso de uso', rascunho.nome, 'caso_uso.gerenciar'), 'Caso de uso salvo.')) setRascunho(null);
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        selo="Controlar"
        titulo="Casos de Uso de IA"
        subtitulo="Biblioteca de usos avaliados. Ao solicitar uma utilização, o colaborador pode partir de um destes modelos."
        acoes={pode('caso_uso.gerenciar') && <Botao variante="dourado" icone={<Plus className="w-4 h-4" />} onClick={() => setRascunho(novo())}>Novo caso de uso</Botao>}
      />

      <Card corpo="p-0">
        <div className="grid sm:grid-cols-3 gap-3 p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input id="cu-busca" className={cx(inputCls, 'pl-9')} placeholder="Buscar nome, processo, objetivo…" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select id="cu-area" className={inputCls} value={area} onChange={e => setArea(e.target.value)}>
            <option value="">Todas as áreas</option>{db.departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select id="cu-status" className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Todos os status</option>{STATUS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {lista.length === 0 ? <Vazio texto="Nenhum caso de uso encontrado." /> : (
          <Tabela minWidth={980} cabecalho={<>
            <th className={thCls}>Caso de uso</th><th className={thCls}>Área / processo</th><th className={thCls}>Ferramentas</th>
            <th className={thCls}>Dados</th><th className={thCls}>Risco</th><th className={thCls}>Status</th><th className={thCls}>Aprovação</th>
            <th className={thCls}>Responsável</th><th className={thCls}>Utilizações</th>
          </>}>
            {lista.map(cu => (
              <tr key={cu.id} className="hover:bg-gov-light/40 cursor-pointer" tabIndex={0} onClick={() => setAberto(cu.id)} onKeyDown={e => e.key === 'Enter' && setAberto(cu.id)}>
                <td className={tdCls}><p className="font-semibold text-slate-800">{cu.nome}</p><p className="text-xs text-slate-500 line-clamp-1">{cu.objetivo}</p></td>
                <td className={tdCls}><p>{ix.departamentos.get(cu.departamentoId)?.nome}</p><p className="text-xs text-slate-500">{cu.processo}</p></td>
                <td className={cx(tdCls, 'text-xs')}>{cu.ferramentaIds.map(id => ix.ferramentas.get(id)?.nome).join(', ')}</td>
                <td className={tdCls}><div className="flex flex-wrap gap-1">{cu.dadosUtilizados.length ? cu.dadosUtilizados.map(t => <Badge key={t} tom={t === 'sensivel' ? 'vermelho' : 'laranja'}>{TIPO_DADO_LABEL[t]}</Badge>) : <span className="text-xs text-slate-500">Sem dados protegidos</span>}</div></td>
                <td className={tdCls}><RiscoBadge nivel={cu.nivelRisco} /></td>
                <td className={tdCls}><Badge tom={cu.status === 'Ativo' ? 'verde' : cu.status === 'Em avaliação' ? 'amarelo' : 'neutro'}>{cu.status}</Badge></td>
                <td className={tdCls}>{cu.aprovado ? <Badge tom="verde">Aprovado</Badge> : <Badge tom="amarelo">Pendente</Badge>}</td>
                <td className={cx(tdCls, 'text-xs')}>{cu.responsavelId ? nome(ix, cu.responsavelId) : <Badge tom="laranja">Sem responsável</Badge>}</td>
                <td className={cx(tdCls, 'tabular-nums font-semibold')}>{instancias(cu.id).length}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>

      {c && (
        <Modal aberto largura="xl" onFechar={() => setAberto(null)} titulo={c.nome} subtitulo={`${ix.departamentos.get(c.departamentoId)?.nome} · ${c.processo}`}
          rodape={podeEditar(c) ? <Botao onClick={() => { setRascunho({ ...c }); setAberto(null); }}>Editar caso de uso</Botao> : undefined}>
          <div className="space-y-5">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Info rotulo="Objetivo" className="col-span-2">{c.objetivo}</Info>
              <Info rotulo="Benefício esperado" className="col-span-2">{c.beneficioEsperado}</Info>
              <Info rotulo="Ferramentas">{c.ferramentaIds.map(id => ix.ferramentas.get(id)?.nome).join(', ')}</Info>
              <Info rotulo="Risco"><RiscoBadge nivel={c.nivelRisco} /></Info>
              <Info rotulo="Status">{c.status} · {c.aprovado ? 'aprovado' : 'aprovação pendente'}</Info>
              <Info rotulo="Responsável">{nome(ix, c.responsavelId)}</Info>
              <Info rotulo="Dados utilizados" className="col-span-2">{c.dadosUtilizados.map(t => TIPO_DADO_LABEL[t]).join(', ') || 'Nenhum dado protegido'}</Info>
              <Info rotulo="Controles" className="col-span-2">{c.controleIds.map(id => ix.controles.get(id)?.nome).join('; ') || '—'}</Info>
              <Info rotulo="Última revisão">{formatarData(c.ultimaRevisao)}</Info>
            </dl>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Utilizações baseadas neste caso</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden"><RegistrosTabela registros={instancias(c.id)} onAbrir={setRegistroAberto} /></div>
            </div>
          </div>
        </Modal>
      )}

      {rascunho && (
        <Modal aberto largura="lg" onFechar={() => setRascunho(null)} titulo={db.casosUso.some(x => x.id === rascunho.id) ? 'Editar caso de uso' : 'Novo caso de uso'}
          rodape={<>
            {db.casosUso.some(x => x.id === rascunho.id) && (
              <BotaoExcluir bloqueio={db.registrosUso.some(r => r.casoUsoId === rascunho.id) ? 'há utilizações vinculadas (use o status Descontinuado)' : undefined}
                onConfirmar={() => executar(() => excluir('casosUso', rascunho.id, 'Caso de uso', rascunho.nome, 'caso_uso.gerenciar'), 'Caso de uso excluído.') && setRascunho(null)} />
            )}
            <Botao variante="secundario" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={salvarCaso}>Salvar</Botao>
          </>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo rotulo="Nome" obrigatorio className="sm:col-span-2"><input id="cu-nome" className={inputCls} value={rascunho.nome} onChange={e => set('nome', e.target.value)} /></Campo>
            <Campo rotulo="Área">
              <select id="cu-dep" className={inputCls} value={rascunho.departamentoId} disabled={escopoDe(usuario) !== 'TUDO'} onChange={e => set('departamentoId', e.target.value)}>
                {db.departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Processo" obrigatorio><input id="cu-proc" className={inputCls} value={rascunho.processo} onChange={e => set('processo', e.target.value)} /></Campo>
            <Campo rotulo="Objetivo" className="sm:col-span-2"><textarea id="cu-obj" className={inputCls} rows={2} value={rascunho.objetivo} onChange={e => set('objetivo', e.target.value)} /></Campo>
            <Campo rotulo="Benefício esperado" className="sm:col-span-2"><input id="cu-ben" className={inputCls} value={rascunho.beneficioEsperado} onChange={e => set('beneficioEsperado', e.target.value)} /></Campo>
            <Campo rotulo="Ferramentas" obrigatorio><Multiselecao opcoes={db.ferramentas.map(f => ({ id: f.id, rotulo: f.nome }))} valor={rascunho.ferramentaIds} onChange={v => set('ferramentaIds', v)} /></Campo>
            <Campo rotulo="Dados utilizados"><Multiselecao opcoes={TIPOS_DADO.map(t => ({ id: t, rotulo: TIPO_DADO_LABEL[t] }))} valor={rascunho.dadosUtilizados} onChange={v => set('dadosUtilizados', v as CasoUso['dadosUtilizados'])} /></Campo>
            <Campo rotulo="Nível de risco">
              <select id="cu-risco" className={inputCls} value={rascunho.nivelRisco} onChange={e => set('nivelRisco', e.target.value as NivelRisco)}>{NIVEIS_RISCO.map(n => <option key={n} value={n}>{NIVEL_RISCO_LABEL[n]}</option>)}</select>
            </Campo>
            <Campo rotulo="Status">
              <select id="cu-st" className={inputCls} value={rascunho.status} onChange={e => set('status', e.target.value as CasoUso['status'])}>{STATUS.map(s => <option key={s}>{s}</option>)}</select>
            </Campo>
            <Campo rotulo="Responsável"><SelectUsuario id="cu-resp" usuarios={db.usuarios} valor={rascunho.responsavelId} onChange={v => set('responsavelId', v)} /></Campo>
            <Campo rotulo="Última revisão"><input id="cu-rev" type="date" className={inputCls} value={rascunho.ultimaRevisao ?? ''} onChange={e => set('ultimaRevisao', e.target.value || undefined)} /></Campo>
            <Campo rotulo="Controles" className="sm:col-span-2"><Multiselecao opcoes={db.controles.map(x => ({ id: x.id, rotulo: x.nome, detalhe: x.tipo }))} valor={rascunho.controleIds} onChange={v => set('controleIds', v)} /></Campo>
            <div className="sm:col-span-2">
              {pode('aprovacao.decidir_alto_risco') || (rascunho.nivelRisco !== 'ALTO' && rascunho.nivelRisco !== 'CRITICO')
                ? <SimNao pergunta="Caso de uso aprovado?" valor={rascunho.aprovado} onChange={v => set('aprovado', v)} />
                : <p className="text-xs text-slate-600">Casos de risco Alto/Crítico são aprovados pelo Administrador / Comitê.</p>}
            </div>
          </div>
        </Modal>
      )}

      {registroAberto && <RegistroDetalhe registroId={registroAberto} onFechar={() => setRegistroAberto(null)} />}
    </div>
  );
};
