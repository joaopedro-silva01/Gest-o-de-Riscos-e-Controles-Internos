/**
 * 🔎 Trilha de Auditoria (seção 16).
 * Quem alterou, o quê, valor anterior, novo valor, data e hora.
 * Filtros por usuário, data, departamento, tipo de alteração, entidade e registro.
 * A trilha é somente leitura — nenhum perfil edita ou apaga eventos.
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, Download, Search } from 'lucide-react';
import { Badge, Botao, Card, KpiCard, PageHeader, Tabela, Vazio, cx, inputCls, tdCls, thCls } from '../components/ui';
import type { AcaoAuditoria, AlteracaoCampo, Entidade, EventoAuditoria } from '../domain/types';
import { valorLegivel } from '../services/audit';
import { nome } from '../services/derived';
import { exportarCsv } from '../services/export';
import { useGovernanca } from '../state/GovernanceContext';
import { formatarDataHora } from '../utils/dates';

const ACOES: AcaoAuditoria[] = ['CRIAÇÃO', 'ALTERAÇÃO', 'EXCLUSÃO', 'SUBMISSÃO', 'APROVAÇÃO', 'REPROVAÇÃO', 'AVANÇO DE ETAPA', 'AJUSTE DE RISCO', 'RECONHECIMENTO'];
const TOM_ACAO: Partial<Record<AcaoAuditoria, 'verde' | 'vermelho' | 'amarelo' | 'azul' | 'dourado'>> = {
  APROVAÇÃO: 'verde', REPROVAÇÃO: 'vermelho', EXCLUSÃO: 'vermelho', 'AJUSTE DE RISCO': 'dourado', SUBMISSÃO: 'azul', CRIAÇÃO: 'azul',
};

export const AuditoriaPage: React.FC = () => {
  const { db, ix, hoje, pode } = useGovernanca();
  const [usuarioId, setUsuarioId] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [dep, setDep] = useState('');
  const [acao, setAcao] = useState('');
  const [entidade, setEntidade] = useState('');
  const [q, setQ] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);

  const entidades = useMemo(() => [...new Set(db.auditoria.map(a => a.entidade))].sort(), [db.auditoria]);
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.auditoria
      .filter(a =>
        (!usuarioId || a.usuarioId === usuarioId) && (!de || a.dataHora.slice(0, 10) >= de) && (!ate || a.dataHora.slice(0, 10) <= ate) &&
        (!dep || a.departamentoId === dep) && (!acao || a.acao === acao) && (!entidade || a.entidade === entidade) &&
        (!t || a.registroRotulo.toLowerCase().includes(t) || a.registroId.toLowerCase().includes(t)))
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  }, [db.auditoria, usuarioId, de, ate, dep, acao, entidade, q]);

  const hojeEventos = db.auditoria.filter(a => a.dataHora.slice(0, 10) === hoje).length;
  const sel = (id: string, v: string, set: (x: string) => void, vazio: string, ops: [string, string][]) => (
    <select id={id} className={inputCls} value={v} onChange={e => set(e.target.value)}><option value="">{vazio}</option>{ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  );

  const exportar = () => exportarCsv<{ a: EventoAuditoria; c: AlteracaoCampo }>(lista.flatMap(a => (a.alteracoes.length ? a.alteracoes : [{ campo: '', anterior: undefined, novo: undefined }]).map(c => ({ a, c }))), [
    { titulo: 'Data/hora', valor: x => formatarDataHora(x.a.dataHora) }, { titulo: 'Usuário', valor: x => nome(ix, x.a.usuarioId) },
    { titulo: 'Ação', valor: x => x.a.acao }, { titulo: 'Entidade', valor: x => x.a.entidade }, { titulo: 'Registro', valor: x => x.a.registroRotulo },
    { titulo: 'Departamento', valor: x => ix.departamentos.get(x.a.departamentoId ?? '')?.nome }, { titulo: 'Campo', valor: x => x.c.campo },
    { titulo: 'Valor anterior', valor: x => valorLegivel(x.c.anterior) }, { titulo: 'Novo valor', valor: x => valorLegivel(x.c.novo) },
  ], `trilha-auditoria-ia-${hoje}.csv`);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Rastreabilidade" titulo="Trilha de Auditoria" subtitulo="Registro imutável de quem alterou o quê, quando, e quais eram os valores antes e depois."
        acoes={pode('relatorio.exportar') && <Botao variante="secundario" icone={<Download className="w-4 h-4" />} onClick={exportar}>Exportar CSV</Botao>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard rotulo="Eventos registrados" valor={db.auditoria.length} tom="navy" />
        <KpiCard rotulo="Eventos hoje" valor={hojeEventos} tom="azul" />
        <KpiCard rotulo="Aprovações / reprovações" valor={db.auditoria.filter(a => a.acao === 'APROVAÇÃO' || a.acao === 'REPROVAÇÃO').length} tom="verde" />
        <KpiCard rotulo="Ajustes manuais de risco" valor={db.auditoria.filter(a => a.acao === 'AJUSTE DE RISCO').length} tom="dourado" />
      </div>

      <Card corpo="p-0">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 p-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input id="aud-q" className={cx(inputCls, 'pl-9')} placeholder="Registro (ex.: IA-0009)" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {sel('aud-usr', usuarioId, setUsuarioId, 'Usuário', db.usuarios.map(u => [u.id, u.nome]))}
          {sel('aud-dep', dep, setDep, 'Departamento', db.departamentos.map(d => [d.id, d.nome]))}
          {sel('aud-acao', acao, setAcao, 'Tipo de alteração', ACOES.map(a => [a, a]))}
          {sel('aud-ent', entidade, setEntidade, 'Entidade', entidades.map(e => [e, e as Entidade]))}
          <input id="aud-de" type="date" aria-label="De" className={inputCls} value={de} onChange={e => setDe(e.target.value)} />
          <input id="aud-ate" type="date" aria-label="Até" className={inputCls} value={ate} onChange={e => setAte(e.target.value)} />
        </div>
        {lista.length === 0 ? <Vazio texto="Nenhum evento para os filtros." /> : (
          <Tabela minWidth={900} cabecalho={<>
            <th className={thCls}>Data / hora</th><th className={thCls}>Usuário</th><th className={thCls}>Ação</th><th className={thCls}>Entidade</th>
            <th className={thCls}>Registro</th><th className={thCls}>Departamento</th><th className={thCls}>Alterações</th>
          </>}>
            {lista.slice(0, 300).map(a => (
              <React.Fragment key={a.id}>
                <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandido(expandido === a.id ? null : a.id)}>
                  <td className={cx(tdCls, 'text-xs whitespace-nowrap tabular-nums')}>{formatarDataHora(a.dataHora)}</td>
                  <td className={cx(tdCls, 'text-sm')}>{nome(ix, a.usuarioId)}</td>
                  <td className={tdCls}><Badge tom={TOM_ACAO[a.acao] ?? 'neutro'}>{a.acao}</Badge></td>
                  <td className={cx(tdCls, 'text-xs')}>{a.entidade}</td>
                  <td className={cx(tdCls, 'text-sm')}>{a.registroRotulo}</td>
                  <td className={cx(tdCls, 'text-xs')}>{ix.departamentos.get(a.departamentoId ?? '')?.nome ?? '—'}</td>
                  <td className={cx(tdCls, 'text-xs whitespace-nowrap')}>
                    {a.alteracoes.length} campo(s) <ChevronDown className={cx('w-3.5 h-3.5 inline transition-transform', expandido === a.id && 'rotate-180')} />
                  </td>
                </tr>
                {expandido === a.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="px-4 py-3">
                      {a.alteracoes.length ? (
                        <table className="w-full text-xs">
                          <thead><tr className="text-left text-slate-500"><th className="py-1 pr-4">Campo</th><th className="py-1 pr-4">Valor anterior</th><th className="py-1">Novo valor</th></tr></thead>
                          <tbody>{a.alteracoes.map((c, i) => (
                            <tr key={i} className="border-t border-slate-200 align-top"><td className="py-1 pr-4 font-semibold">{c.campo}</td><td className="py-1 pr-4 text-slate-600 break-words max-w-xs">{valorLegivel(c.anterior)}</td><td className="py-1 text-slate-900 break-words max-w-xs">{valorLegivel(c.novo)}</td></tr>
                          ))}</tbody>
                        </table>
                      ) : <p className="text-xs text-slate-500">Evento sem alteração de campos.</p>}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </Tabela>
        )}
        {lista.length > 300 && <p className="text-xs text-slate-500 px-4 py-2">Exibindo 300 de {lista.length} eventos. Refine os filtros ou exporte o CSV completo.</p>}
      </Card>
    </div>
  );
};
