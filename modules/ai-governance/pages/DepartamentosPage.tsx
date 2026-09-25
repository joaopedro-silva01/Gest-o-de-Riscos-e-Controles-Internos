/**
 * 🏢 Mapa de Uso de IA por Departamento (seção 7).
 * Cada cartão resume a área; clicar abre o detalhamento.
 */
import React, { useMemo, useState } from 'react';
import { FiltrosGlobaisBar } from '../components/FiltrosGlobaisBar';
import { RegistroDetalhe } from '../components/RegistroDetalhe';
import { RegistrosTabela } from '../components/RegistrosTabela';
import { Badge, Info, Modal, PageHeader, Vazio, cx } from '../components/ui';
import { NIVEIS_RISCO, NIVEL_RISCO_COR, NIVEL_RISCO_LABEL, STATUS_AUTORIZADOS, STATUS_INCIDENTE_ABERTO, STATUS_PENDENTES } from '../domain/catalogs';
import { departamentoDoIncidente, nome, situacaoTreinamento } from '../services/derived';
import { nivelEfetivo } from '../services/riskEngine';
import { useGovernanca } from '../state/GovernanceContext';

export const DepartamentosPage: React.FC = () => {
  const { db, ix, registrosFiltrados, incidentesFiltrados, alertas, hoje } = useGovernanca();
  const [aberto, setAberto] = useState<string | null>(null);
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);

  const mapa = useMemo(() => db.departamentos.map(d => {
    const regs = registrosFiltrados.filter(r => ix.usuarios.get(r.colaboradorId)?.departamentoId === d.id);
    const ativos = regs.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado');
    const riscos = Object.fromEntries(NIVEIS_RISCO.map(n => [n, ativos.filter(r => nivelEfetivo(r) === n).length])) as Record<string, number>;
    return {
      d, regs, ativos, riscos,
      usuarios: new Set(ativos.map(r => r.colaboradorId)).size,
      ferramentas: [...new Set(ativos.map(r => r.ferramentaId))],
      pendencias: alertas.filter(a => !a.reconhecido && a.departamentoId === d.id).length,
      aprovacoesPendentes: regs.filter(r => STATUS_PENDENTES.includes(r.status)).length,
      aprovados: regs.filter(r => STATUS_AUTORIZADOS.includes(r.status)).length,
      incidentes: incidentesFiltrados.filter(i => departamentoDoIncidente(ix, i) === d.id).length,
    };
  }).filter(x => x.regs.length > 0).sort((a, b) => b.ativos.length - a.ativos.length), [db.departamentos, registrosFiltrados, ix, alertas, incidentesFiltrados]);

  const sel = aberto ? mapa.find(x => x.d.id === aberto) : undefined;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Controlar" titulo="Mapa de Uso de IA por Departamento" subtitulo="Clique numa área para ver o detalhamento." />
      <FiltrosGlobaisBar />

      {mapa.length === 0 ? <Vazio texto="Nenhuma área com utilizações para os filtros atuais." /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {mapa.map(m => {
            const total = m.ativos.length || 1;
            return (
              <button key={m.d.id} onClick={() => setAberto(m.d.id)} className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-gov-sky transition-all flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gov-navy text-lg uppercase tracking-wide">{m.d.nome}</h3>
                    <p className="text-xs text-slate-500">Gestor: {nome(ix, m.d.gestorId)}</p>
                  </div>
                  {m.pendencias > 0 && <Badge tom="laranja">{m.pendencias} pendência(s)</Badge>}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-[10px] uppercase font-bold text-slate-500">Usuários</dt><dd className="font-bold text-xl text-gov-navy tabular-nums">{m.usuarios}</dd></div>
                  <div><dt className="text-[10px] uppercase font-bold text-slate-500">Casos de uso</dt><dd className="font-bold text-xl text-gov-navy tabular-nums">{m.ativos.length}</dd></div>
                  <div><dt className="text-[10px] uppercase font-bold text-slate-500">Incidentes</dt><dd className={cx('font-bold text-xl tabular-nums', m.incidentes ? 'text-red-700' : 'text-gov-navy')}>{m.incidentes}</dd></div>
                </dl>
                <p className="text-sm text-slate-700"><span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Ferramentas</span>{m.ferramentas.map(id => ix.ferramentas.get(id)?.nome).join(' / ') || '—'}</p>
                {/* Barra empilhada de risco com rótulos textuais (cor nunca sozinha). */}
                <div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-px">
                    {NIVEIS_RISCO.map(n => m.riscos[n] > 0 && <div key={n} style={{ width: `${(m.riscos[n] / total) * 100}%`, background: NIVEL_RISCO_COR[n] }} title={`${NIVEL_RISCO_LABEL[n]}: ${m.riscos[n]}`} />)}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 flex flex-wrap gap-x-3">
                    {NIVEIS_RISCO.map(n => <span key={n}><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: NIVEL_RISCO_COR[n] }} />{NIVEL_RISCO_LABEL[n]}: <strong className="tabular-nums">{m.riscos[n]}</strong></span>)}
                  </p>
                </div>
                <p className="text-xs text-slate-600">Aprovações: <strong>{m.aprovados}</strong> autorizadas · <strong className={m.aprovacoesPendentes ? 'text-amber-800' : ''}>{m.aprovacoesPendentes}</strong> pendentes</p>
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <Modal aberto largura="xl" onFechar={() => setAberto(null)} titulo={sel.d.nome} subtitulo={`Gestor: ${nome(ix, sel.d.gestorId)}`}>
          <div className="space-y-5">
            <dl className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Info rotulo="Usuários de IA">{sel.usuarios}</Info>
              <Info rotulo="Casos de uso ativos">{sel.ativos.length}</Info>
              <Info rotulo="Aprovações pendentes">{sel.aprovacoesPendentes}</Info>
              <Info rotulo="Pendências (alertas)">{sel.pendencias}</Info>
              <Info rotulo="Incidentes">{sel.incidentes}</Info>
            </dl>
            <section>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Colaboradores</p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {db.usuarios.filter(u => u.departamentoId === sel.d.id).map(u => {
                  const n = sel.ativos.filter(r => r.colaboradorId === u.id).length;
                  const t = situacaoTreinamento(db, u, hoje);
                  return (
                    <li key={u.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex justify-between gap-2">
                      <span><strong className="font-semibold">{u.nome}</strong><br /><span className="text-xs text-slate-500">{n} uso(s) ativo(s)</span></span>
                      <Badge tom={t === 'Treinado' ? 'verde' : t === 'Vencido' ? 'amarelo' : 'laranja'}>{t}</Badge>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Utilizações</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden"><RegistrosTabela registros={sel.regs} onAbrir={setRegistroAberto} /></div>
            </section>
            <section>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Incidentes da área</p>
              <ul className="text-sm space-y-1">
                {incidentesFiltrados.filter(i => departamentoDoIncidente(ix, i) === sel.d.id).map(i => (
                  <li key={i.id}><span className="font-mono text-xs text-gov-blue">{i.codigo}</span> {i.tipo} — {i.descricao} <Badge tom={STATUS_INCIDENTE_ABERTO.includes(i.status) ? 'laranja' : 'verde'}>{i.status}</Badge></li>
                ))}
                {sel.incidentes === 0 && <li className="text-slate-500">Nenhum incidente.</li>}
              </ul>
            </section>
          </div>
        </Modal>
      )}
      {registroAberto && <RegistroDetalhe registroId={registroAberto} onFechar={() => setRegistroAberto(null)} />}
    </div>
  );
};
