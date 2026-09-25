/**
 * 📑 Políticas de Uso de IA (seção 12) — pilar ORIENTAR.
 * Regras por tipo e versionamento: qualquer mudança nas regras gera uma nova
 * versão (1.0 → 1.1 → 2.0) com data, responsável e descrição das alterações.
 */
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SelectUsuario } from '../components/forms';
import { Badge, Botao, Campo, Card, Info, Modal, PageHeader, cx, inputCls } from '../components/ui';
import type { Politica, RegraPolitica } from '../domain/types';
import { nome } from '../services/derived';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { addMeses, diasEntre, formatarData, novoId } from '../utils/dates';

const TIPOS_REGRA: RegraPolitica['tipo'][] = [
  'Dados permitidos', 'Dados proibidos', 'Ferramentas autorizadas', 'Ferramentas restritas', 'Necessidade de aprovação',
  'Responsabilidades', 'IA generativa', 'Automações', 'Dados de clientes',
];
const STATUS: Politica['status'][] = ['Vigente', 'Em revisão', 'Rascunho', 'Revogada'];

/** Próxima versão: menor (1.1 → 1.2) ou maior (1.2 → 2.0). */
export const proximaVersao = (atual: string, tipo: 'menor' | 'maior'): string => {
  const [ma, me] = atual.split('.').map(n => Number(n) || 0);
  return tipo === 'maior' ? `${ma + 1}.0` : `${ma}.${me + 1}`;
};

export const PoliticasPage: React.FC = () => {
  const { db, ix, pode, salvar, hoje, usuario } = useGovernanca();
  const executar = useAcao();
  const [selId, setSelId] = useState(db.politicas[0]?.id ?? '');
  const [rascunho, setRascunho] = useState<Politica | null>(null);
  const [tipoVersao, setTipoVersao] = useState<'menor' | 'maior'>('menor');
  const [alteracoes, setAlteracoes] = useState('');
  const gerencia = pode('politica.gerenciar');
  const p = ix.politicas.get(selId) ?? db.politicas[0];

  const nova = (): Politica => ({
    id: novoId('pol'), titulo: '', descricao: '', versaoAtual: '1.0', status: 'Rascunho', vigenciaAte: addMeses(hoje, 12),
    responsavelId: usuario.id, regras: [], versoes: [],
  });

  const existente = rascunho && db.politicas.some(x => x.id === rascunho.id);
  const original = existente ? ix.politicas.get(rascunho!.id) : undefined;
  const regrasMudaram = !!original && JSON.stringify(original.regras) !== JSON.stringify(rascunho!.regras);

  const setR = <K extends keyof Politica>(k: K, v: Politica[K]) => setRascunho(r => (r ? { ...r, [k]: v } : r));
  const setRegra = (id: string, patch: Partial<RegraPolitica>) => setR('regras', rascunho!.regras.map(g => (g.id === id ? { ...g, ...patch } : g)));

  const gravar = (novaVersao: boolean) => {
    const r = rascunho!;
    if (!r.titulo.trim()) return executar(() => { throw new Error('Informe o título da política.'); });
    if (r.regras.some(g => !g.descricao.trim())) return executar(() => { throw new Error('Preencha a descrição de todas as regras ou remova as vazias.'); });
    let item = r;
    if (!existente) {
      item = { ...r, versoes: [{ versao: r.versaoAtual, data: hoje, responsavelId: usuario.id, alteracoes: alteracoes.trim() || 'Versão inicial.' }] };
    } else if (novaVersao) {
      if (!alteracoes.trim()) return executar(() => { throw new Error('Descreva as alterações realizadas nesta versão.'); });
      const versao = proximaVersao(r.versaoAtual, tipoVersao);
      item = { ...r, versaoAtual: versao, versoes: [...r.versoes, { versao, data: hoje, responsavelId: usuario.id, alteracoes: alteracoes.trim() }] };
    } else if (regrasMudaram) {
      return executar(() => { throw new Error('As regras mudaram: publique uma nova versão para manter o histórico.'); });
    }
    if (executar(() => salvar('politicas', item, 'Política', `${item.titulo} v${item.versaoAtual}`, 'politica.gerenciar'), novaVersao ? `Versão ${item.versaoAtual} publicada.` : 'Política salva.')) {
      setRascunho(null);
      setAlteracoes('');
      setSelId(item.id);
    }
  };

  const diasVig = p ? diasEntre(hoje, p.vigenciaAte) : 0;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Orientar" titulo="Políticas de Uso de IA" subtitulo="Regras que definem o que pode, o que não pode e quem responde pelo uso de IA."
        acoes={gerencia && <Botao variante="dourado" icone={<Plus className="w-4 h-4" />} onClick={() => { setRascunho(nova()); setAlteracoes(''); }}>Nova política</Botao>} />

      <div className="grid lg:grid-cols-4 gap-4">
        <nav className="space-y-2" aria-label="Políticas">
          {db.politicas.map(x => (
            <button key={x.id} onClick={() => setSelId(x.id)} className={cx('w-full text-left rounded-xl border p-3 transition-all', x.id === p?.id ? 'border-gov-navy bg-gov-light/50' : 'border-slate-200 bg-white hover:border-slate-300')}>
              <p className="font-semibold text-sm text-slate-800">{x.titulo}</p>
              <p className="text-xs text-slate-500 mt-0.5">v{x.versaoAtual} · {x.status} · até {formatarData(x.vigenciaAte)}</p>
            </button>
          ))}
        </nav>

        {p && (
          <div className="lg:col-span-3 space-y-4">
            <Card titulo={<span className="flex flex-wrap items-center gap-2">{p.titulo} <Badge tom="navy">v{p.versaoAtual}</Badge> <Badge tom={p.status === 'Vigente' ? 'verde' : p.status === 'Revogada' ? 'neutro' : 'amarelo'}>{p.status}</Badge></span>}
              subtitulo={p.descricao}
              acoes={gerencia && <Botao tamanho="sm" variante="secundario" onClick={() => { setRascunho(JSON.parse(JSON.stringify(p))); setAlteracoes(''); setTipoVersao('menor'); }}>Editar / nova versão</Botao>}>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Info rotulo="Responsável">{nome(ix, p.responsavelId)}</Info>
                <Info rotulo="Vigência até"><span className={cx(diasVig < 0 ? 'text-red-700 font-semibold' : diasVig <= db.configuracoes.diasAvisoPolitica && 'text-amber-800 font-semibold')}>{formatarData(p.vigenciaAte)}{diasVig < 0 ? ' (vencida)' : diasVig <= db.configuracoes.diasAvisoPolitica ? ` (${diasVig} dias)` : ''}</span></Info>
                <Info rotulo="Regras">{p.regras.length}</Info>
                <Info rotulo="Ferramentas vinculadas">{db.ferramentas.filter(f => f.politicaId === p.id).map(f => f.nome).join(', ') || '—'}</Info>
              </dl>
              <div className="grid md:grid-cols-2 gap-3">
                {TIPOS_REGRA.filter(t => p.regras.some(r => r.tipo === t)).map(t => (
                  <section key={t} className={cx('rounded-lg border p-3', t === 'Dados proibidos' || t === 'Ferramentas restritas' ? 'border-red-200 bg-red-50/40' : 'border-slate-200')}>
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">{t}</h4>
                    <ul className="list-disc ml-5 text-sm text-slate-800 space-y-1">{p.regras.filter(r => r.tipo === t).map(r => <li key={r.id}>{r.descricao}</li>)}</ul>
                  </section>
                ))}
              </div>
            </Card>
            <Card titulo="Histórico de versões">
              <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                {[...p.versoes].reverse().map(v => (
                  <li key={v.versao} className="ml-4">
                    <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-gov-gold border-2 border-white" />
                    <p className="text-sm font-semibold text-gov-navy">Versão {v.versao} <span className="font-normal text-xs text-slate-500">· {formatarData(v.data)} · {nome(ix, v.responsavelId)}</span></p>
                    <p className="text-sm text-slate-700">{v.alteracoes}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        )}
      </div>

      {rascunho && (
        <Modal aberto largura="xl" onFechar={() => setRascunho(null)} titulo={existente ? `Editar política (v${rascunho.versaoAtual})` : 'Nova política'}
          subtitulo={existente ? 'Mudanças nas regras exigem publicar nova versão.' : undefined}
          rodape={existente ? <>
            <Botao variante="secundario" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao variante="secundario" onClick={() => gravar(false)} disabled={regrasMudaram} title={regrasMudaram ? 'As regras mudaram: publique nova versão' : undefined}>Salvar dados gerais</Botao>
            <Botao variante="dourado" onClick={() => gravar(true)}>Publicar versão {proximaVersao(rascunho.versaoAtual, tipoVersao)}</Botao>
          </> : <>
            <Botao variante="secundario" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={() => gravar(false)}>Criar política (v{rascunho.versaoAtual})</Botao>
          </>}>
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="space-y-4">
              <Campo rotulo="Título" obrigatorio><input id="pol-tit" className={inputCls} value={rascunho.titulo} onChange={e => setR('titulo', e.target.value)} /></Campo>
              <Campo rotulo="Descrição"><textarea id="pol-desc" className={inputCls} rows={3} value={rascunho.descricao} onChange={e => setR('descricao', e.target.value)} /></Campo>
              <Campo rotulo="Status"><select id="pol-st" className={inputCls} value={rascunho.status} onChange={e => setR('status', e.target.value as Politica['status'])}>{STATUS.map(s => <option key={s}>{s}</option>)}</select></Campo>
              <Campo rotulo="Vigência até"><input id="pol-vig" type="date" className={inputCls} value={rascunho.vigenciaAte} onChange={e => setR('vigenciaAte', e.target.value)} /></Campo>
              <Campo rotulo="Responsável"><SelectUsuario id="pol-resp" usuarios={db.usuarios} valor={rascunho.responsavelId} onChange={v => setR('responsavelId', v)} /></Campo>
              {existente && (
                <fieldset className="rounded-lg border border-amber-200 bg-gov-goldsoft/40 p-3 space-y-2">
                  <legend className="text-xs font-bold text-gov-golddeep px-1">Nova versão</legend>
                  <div className="flex gap-2">
                    {(['menor', 'maior'] as const).map(t => (
                      <label key={t} className="flex items-center gap-1.5 text-sm"><input type="radio" className="accent-[#1d4e89]" checked={tipoVersao === t} onChange={() => setTipoVersao(t)} />{t === 'menor' ? `Ajuste (${proximaVersao(rascunho.versaoAtual, 'menor')})` : `Revisão maior (${proximaVersao(rascunho.versaoAtual, 'maior')})`}</label>
                    ))}
                  </div>
                  <textarea id="pol-alt" className={inputCls} rows={3} placeholder="Alterações realizadas (obrigatório para publicar)" value={alteracoes} onChange={e => setAlteracoes(e.target.value)} />
                </fieldset>
              )}
            </div>
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Regras ({rascunho.regras.length}){regrasMudaram && <span className="text-gov-golddeep normal-case font-semibold"> · alteradas</span>}</p>
                <Botao tamanho="sm" variante="secundario" icone={<Plus className="w-3.5 h-3.5" />} onClick={() => setR('regras', [...rascunho.regras, { id: novoId('rg'), tipo: 'Dados permitidos', descricao: '' }])}>Adicionar regra</Botao>
              </div>
              <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {rascunho.regras.map(r => (
                  <li key={r.id} className="grid sm:grid-cols-[180px_1fr_auto] gap-2 items-start rounded-lg border border-slate-200 p-2">
                    <select aria-label="Tipo de regra" className={inputCls} value={r.tipo} onChange={e => setRegra(r.id, { tipo: e.target.value as RegraPolitica['tipo'] })}>{TIPOS_REGRA.map(t => <option key={t}>{t}</option>)}</select>
                    <textarea aria-label="Descrição da regra" className={inputCls} rows={2} value={r.descricao} onChange={e => setRegra(r.id, { descricao: e.target.value })} />
                    <button className="p-2 text-slate-400 hover:text-red-700" aria-label="Remover regra" onClick={() => setR('regras', rascunho.regras.filter(x => x.id !== r.id))}><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}
                {!rascunho.regras.length && <li className="text-sm text-slate-500">Nenhuma regra. Adicione dados permitidos, proibidos, ferramentas, responsabilidades…</li>}
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
