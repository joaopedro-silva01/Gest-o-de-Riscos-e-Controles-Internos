/**
 * 🤖 Catálogo de Ferramentas (seções 3 e 11) — pilar HOMOLOGAR.
 * Estar cadastrada NÃO significa ser segura: cada ferramenta exibe categoria,
 * risco, restrições, uso real (usuários/casos) e ocorrências.
 */
import React, { useMemo, useState } from 'react';
import { ExternalLink, Plus, Pencil, RefreshCw } from 'lucide-react';
import { BotaoExcluir, LinhasTextarea, SelectUsuario, useRascunho } from '../components/forms';
import { RegistroDetalhe } from '../components/RegistroDetalhe';
import { RegistrosTabela } from '../components/RegistrosTabela';
import { Badge, Botao, Campo, Card, CategoriaBadge, Info, KpiCard, Modal, PageHeader, RiscoBadge, SimNao, cx, inputCls } from '../components/ui';
import { CATEGORIAS_HOMOLOGACAO, CATEGORIA_LABEL, NIVEIS_RISCO, NIVEL_RISCO_LABEL, STATUS_INCIDENTE_ABERTO, STATUS_PENDENTES } from '../domain/catalogs';
import type { CategoriaHomologacao, FerramentaIA, NivelRisco, StatusFerramenta, TipoFerramenta, UsoRecomendado } from '../domain/types';
import { nome } from '../services/derived';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { diasEntre, formatarData, novoId } from '../utils/dates';

const TIPOS: TipoFerramenta[] = ['Corporativa integrada', 'Pública (SaaS)', 'Embarcada em fornecedor', 'Interna'];
const STATUS: StatusFerramenta[] = ['Ativa', 'Em avaliação', 'Suspensa', 'Descontinuada'];
const USOS: UsoRecomendado[] = ['Prioritário', 'Controlado', 'Restrito'];

const nova = (): FerramentaIA => ({
  id: novoId('fer'), nome: '', fornecedor: '', categoria: 'NAO_HOMOLOGADA', tipo: 'Pública (SaaS)', url: '', status: 'Em avaliação',
  usoRecomendado: 'Restrito', descricao: '', exposicaoExterna: true, nivelRisco: 'ALTO', permissoes: [], restricoes: [], observacoes: '',
});

export const FerramentasPage: React.FC = () => {
  const { db, ix, registros, incidentesEscopo, pode, salvar, excluir, hoje, usuario } = useGovernanca();
  const executar = useAcao();
  const [categoria, setCategoria] = useState<CategoriaHomologacao | ''>('');
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);
  const { rascunho, setRascunho, set } = useRascunho<FerramentaIA>(null);
  const gerencia = pode('ferramenta.gerenciar');

  const estat = useMemo(() => {
    const m = new Map<string, { usuarios: number; casos: number; pendentes: number; ocorrencias: number }>();
    for (const f of db.ferramentas) {
      const regs = registros.filter(r => r.ferramentaId === f.id && r.status !== 'Encerrado' && r.status !== 'Não aprovado');
      m.set(f.id, {
        usuarios: new Set(regs.map(r => r.colaboradorId)).size,
        casos: new Set(regs.map(r => r.casoUsoId ?? r.id)).size,
        pendentes: regs.filter(r => STATUS_PENDENTES.includes(r.status)).length,
        ocorrencias: incidentesEscopo.filter(i => i.ferramentaId === f.id).length,
      });
    }
    return m;
  }, [db.ferramentas, registros, incidentesEscopo]);

  const lista = db.ferramentas.filter(f => !categoria || f.categoria === categoria);
  const f = detalhe ? ix.ferramentas.get(detalhe) : undefined;

  const salvarFerramenta = () => {
    if (!rascunho) return;
    if (!rascunho.nome.trim() || !rascunho.fornecedor.trim()) return executar(() => { throw new Error('Informe nome e fornecedor.'); });
    // Homologar exige data e responsável: rastreabilidade da decisão.
    const item = rascunho.categoria === 'HOMOLOGADA' && !rascunho.dataHomologacao
      ? { ...rascunho, dataHomologacao: hoje, responsavelHomologacaoId: rascunho.responsavelHomologacaoId ?? usuario.id }
      : rascunho;
    if (executar(() => salvar('ferramentas', item, 'Ferramenta', item.nome, 'ferramenta.gerenciar'), 'Ferramenta salva.')) setRascunho(null);
  };

  const revisar = (fe: FerramentaIA) => executar(() => salvar('ferramentas', { ...fe, ultimaRevisao: hoje }, 'Ferramenta', fe.nome, 'ferramenta.gerenciar'), 'Revisão da ferramenta registrada.');

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        selo="Homologar"
        titulo="Catálogo de Ferramentas"
        subtitulo="Estar cadastrada não significa estar segura: confira categoria, risco e restrições antes de usar."
        acoes={gerencia && <Botao variante="dourado" icone={<Plus className="w-4 h-4" />} onClick={() => setRascunho(nova())}>Nova ferramenta</Botao>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard rotulo="Ferramentas cadastradas" valor={db.ferramentas.length} tom="navy" onClick={() => setCategoria('')} detalhe={categoria ? 'Clique para ver todas' : undefined} />
        {CATEGORIAS_HOMOLOGACAO.map(c => (
          <KpiCard key={c} rotulo={CATEGORIA_LABEL[c]} valor={db.ferramentas.filter(x => x.categoria === c).length}
            tom={c === 'HOMOLOGADA' ? 'verde' : c === 'NAO_HOMOLOGADA' ? 'vermelho' : 'dourado'}
            onClick={() => setCategoria(categoria === c ? '' : c)} detalhe={categoria === c ? 'Filtro ativo' : 'Clique para filtrar'} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lista.map(fe => {
          const e = estat.get(fe.id)!;
          const semRevisao = !fe.ultimaRevisao || diasEntre(fe.ultimaRevisao, hoje) > db.configuracoes.diasRevisaoFerramenta;
          return (
            <article key={fe.id} className={cx('bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3', fe.categoria === 'NAO_HOMOLOGADA' ? 'border-red-200' : 'border-slate-200')}>
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-gov-navy text-lg leading-tight">{fe.nome}</h3>
                  <p className="text-xs text-slate-500">{fe.fornecedor} · {fe.tipo}</p>
                </div>
                <RiscoBadge nivel={fe.nivelRisco} />
              </header>
              <div className="flex flex-wrap gap-1.5">
                <CategoriaBadge categoria={fe.categoria} />
                <Badge tom="neutro">Uso {fe.usoRecomendado.toLowerCase()}</Badge>
                <Badge tom={fe.status === 'Ativa' ? 'azul' : fe.status === 'Suspensa' ? 'laranja' : 'neutro'}>{fe.status}</Badge>
              </div>
              <p className="text-sm text-slate-600 line-clamp-3">{fe.descricao}</p>
              <dl className="grid grid-cols-4 gap-2 text-center rounded-lg bg-slate-50 border border-slate-100 py-2">
                <div><dt className="text-[10px] uppercase font-bold text-slate-500">Usuários</dt><dd className="font-bold text-gov-navy tabular-nums">{e.usuarios}</dd></div>
                <div><dt className="text-[10px] uppercase font-bold text-slate-500">Casos</dt><dd className="font-bold text-gov-navy tabular-nums">{e.casos}</dd></div>
                <div><dt className="text-[10px] uppercase font-bold text-slate-500">Pendências</dt><dd className={cx('font-bold tabular-nums', e.pendentes ? 'text-amber-700' : 'text-gov-navy')}>{e.pendentes}</dd></div>
                <div><dt className="text-[10px] uppercase font-bold text-slate-500">Ocorrências</dt><dd className={cx('font-bold tabular-nums', e.ocorrencias ? 'text-red-700' : 'text-gov-navy')}>{e.ocorrencias}</dd></div>
              </dl>
              {fe.restricoes.length > 0 && <p className="text-xs text-slate-600"><strong>Restrições:</strong> {fe.restricoes.join(' · ')}</p>}
              <p className={cx('text-xs', semRevisao ? 'text-amber-800' : 'text-slate-500')}>
                Última revisão: {formatarData(fe.ultimaRevisao)}{semRevisao && ' · revisão pendente'} · Responsável: {nome(ix, fe.responsavelHomologacaoId)}
              </p>
              <footer className="flex flex-wrap gap-2 mt-auto pt-1">
                <Botao tamanho="sm" variante="secundario" onClick={() => setDetalhe(fe.id)}>Ver detalhes</Botao>
                {gerencia && <Botao tamanho="sm" variante="fantasma" icone={<Pencil className="w-3.5 h-3.5" />} onClick={() => setRascunho({ ...fe })}>Editar</Botao>}
                {gerencia && <Botao tamanho="sm" variante="fantasma" icone={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => revisar(fe)}>Registrar revisão</Botao>}
              </footer>
            </article>
          );
        })}
      </div>

      {f && (
        <Modal aberto largura="xl" onFechar={() => setDetalhe(null)} titulo={<span className="flex flex-wrap gap-2 items-center">{f.nome} <CategoriaBadge categoria={f.categoria} /></span>} subtitulo={`${f.fornecedor} · ${f.tipo}`}>
          <div className="space-y-5">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Info rotulo="Status">{f.status}</Info>
              <Info rotulo="Uso recomendado">{f.usoRecomendado}</Info>
              <Info rotulo="Nível de risco"><RiscoBadge nivel={f.nivelRisco} /></Info>
              <Info rotulo="Exposição externa">{f.exposicaoExterna ? 'Sim — dados saem do ambiente corporativo' : 'Não'}</Info>
              <Info rotulo="Homologação">{f.dataHomologacao ? `${formatarData(f.dataHomologacao)} por ${nome(ix, f.responsavelHomologacaoId)}` : 'Não homologada'}</Info>
              <Info rotulo="Última revisão">{formatarData(f.ultimaRevisao)}</Info>
              <Info rotulo="Política aplicável">{f.politicaId ? ix.politicas.get(f.politicaId)?.titulo : '—'}</Info>
              <Info rotulo="URL">{f.url ? <a className="text-gov-blue hover:underline inline-flex items-center gap-1" href={f.url} target="_blank" rel="noreferrer">{f.url.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3" /></a> : '—'}</Info>
            </dl>
            <p className="text-sm text-slate-700">{f.descricao}</p>
            <div className="grid md:grid-cols-2 gap-4">
              <Card titulo="Permissões" corpo="px-5 pb-4 pt-2"><ul className="list-disc ml-5 text-sm space-y-0.5">{f.permissoes.map(p => <li key={p}>{p}</li>)}{!f.permissoes.length && <li className="list-none -ml-5 text-slate-500">Nenhuma definida.</li>}</ul></Card>
              <Card titulo="Restrições" corpo="px-5 pb-4 pt-2"><ul className="list-disc ml-5 text-sm space-y-0.5">{f.restricoes.map(p => <li key={p}>{p}</li>)}{!f.restricoes.length && <li className="list-none -ml-5 text-slate-500">Nenhuma definida.</li>}</ul></Card>
            </div>
            {f.observacoes && <Info rotulo="Observações">{f.observacoes}</Info>}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Utilizações registradas com esta ferramenta</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden"><RegistrosTabela registros={registros.filter(r => r.ferramentaId === f.id)} onAbrir={setRegistroAberto} /></div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Incidentes</p>
              <ul className="text-sm space-y-1">
                {incidentesEscopo.filter(i => i.ferramentaId === f.id).map(i => (
                  <li key={i.id} className="flex flex-wrap gap-2 items-center"><span className="font-mono text-xs text-gov-blue">{i.codigo}</span>{i.tipo} <Badge tom={STATUS_INCIDENTE_ABERTO.includes(i.status) ? 'laranja' : 'verde'}>{i.status}</Badge></li>
                ))}
                {!incidentesEscopo.some(i => i.ferramentaId === f.id) && <li className="text-slate-500">Nenhum incidente.</li>}
              </ul>
            </div>
          </div>
        </Modal>
      )}

      {rascunho && (
        <Modal aberto largura="lg" onFechar={() => setRascunho(null)} titulo={db.ferramentas.some(x => x.id === rascunho.id) ? `Editar ${rascunho.nome}` : 'Nova ferramenta de IA'}
          rodape={<>
            {db.ferramentas.some(x => x.id === rascunho.id) && (
              <BotaoExcluir
                bloqueio={db.registrosUso.some(r => r.ferramentaId === rascunho.id) ? 'há utilizações registradas (altere o status para Descontinuada)' : undefined}
                onConfirmar={() => executar(() => excluir('ferramentas', rascunho.id, 'Ferramenta', rascunho.nome, 'ferramenta.gerenciar'), 'Ferramenta excluída.') && setRascunho(null)}
              />
            )}
            <Botao variante="secundario" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={salvarFerramenta}>Salvar</Botao>
          </>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo rotulo="Nome" obrigatorio><input id="fer-nome" className={inputCls} value={rascunho.nome} onChange={e => set('nome', e.target.value)} /></Campo>
            <Campo rotulo="Empresa fornecedora" obrigatorio><input id="fer-forn" className={inputCls} value={rascunho.fornecedor} onChange={e => set('fornecedor', e.target.value)} /></Campo>
            <Campo rotulo="Categoria de homologação">
              <select id="fer-cat" className={inputCls} value={rascunho.categoria} onChange={e => set('categoria', e.target.value as CategoriaHomologacao)}>
                {CATEGORIAS_HOMOLOGACAO.map(c => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Tipo de ferramenta">
              <select id="fer-tipo" className={inputCls} value={rascunho.tipo} onChange={e => set('tipo', e.target.value as TipoFerramenta)}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
            </Campo>
            <Campo rotulo="Status">
              <select id="fer-status" className={inputCls} value={rascunho.status} onChange={e => set('status', e.target.value as StatusFerramenta)}>{STATUS.map(t => <option key={t}>{t}</option>)}</select>
            </Campo>
            <Campo rotulo="Uso recomendado">
              <select id="fer-uso" className={inputCls} value={rascunho.usoRecomendado} onChange={e => set('usoRecomendado', e.target.value as UsoRecomendado)}>{USOS.map(t => <option key={t}>{t}</option>)}</select>
            </Campo>
            <Campo rotulo="Nível de risco da ferramenta">
              <select id="fer-risco" className={inputCls} value={rascunho.nivelRisco} onChange={e => set('nivelRisco', e.target.value as NivelRisco)}>{NIVEIS_RISCO.map(n => <option key={n} value={n}>{NIVEL_RISCO_LABEL[n]}</option>)}</select>
            </Campo>
            <Campo rotulo="URL"><input id="fer-url" className={inputCls} value={rascunho.url} onChange={e => set('url', e.target.value)} placeholder="https://" /></Campo>
            <Campo rotulo="Data da homologação"><input id="fer-dthom" type="date" className={inputCls} value={rascunho.dataHomologacao ?? ''} onChange={e => set('dataHomologacao', e.target.value || undefined)} /></Campo>
            <Campo rotulo="Responsável pela homologação"><SelectUsuario id="fer-resp" usuarios={db.usuarios} valor={rascunho.responsavelHomologacaoId} onChange={v => set('responsavelHomologacaoId', v)} /></Campo>
            <Campo rotulo="Política aplicável">
              <select id="fer-pol" className={inputCls} value={rascunho.politicaId ?? ''} onChange={e => set('politicaId', e.target.value || undefined)}>
                <option value="">Nenhuma</option>{db.politicas.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Última revisão"><input id="fer-rev" type="date" className={inputCls} value={rascunho.ultimaRevisao ?? ''} onChange={e => set('ultimaRevisao', e.target.value || undefined)} /></Campo>
            <div className="sm:col-span-2"><SimNao pergunta="Os dados inseridos saem do ambiente corporativo (exposição externa)?" valor={rascunho.exposicaoExterna} onChange={v => set('exposicaoExterna', v)} /></div>
            <Campo rotulo="Descrição / orientação de uso" className="sm:col-span-2"><textarea id="fer-desc" className={inputCls} rows={2} value={rascunho.descricao} onChange={e => set('descricao', e.target.value)} /></Campo>
            <Campo rotulo="Permissões (uma por linha)"><LinhasTextarea id="fer-perm" valor={rascunho.permissoes} onChange={v => set('permissoes', v)} /></Campo>
            <Campo rotulo="Restrições (uma por linha)"><LinhasTextarea id="fer-restr" valor={rascunho.restricoes} onChange={v => set('restricoes', v)} /></Campo>
            <Campo rotulo="Observações" className="sm:col-span-2"><textarea id="fer-obs" className={inputCls} rows={2} value={rascunho.observacoes} onChange={e => set('observacoes', e.target.value)} /></Campo>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Mudar a categoria altera o cálculo de risco das próximas avaliações; registros existentes são recalculados ao serem editados.</p>
        </Modal>
      )}

      {registroAberto && <RegistroDetalhe registroId={registroAberto} onFechar={() => setRegistroAberto(null)} />}
    </div>
  );
};
