/**
 * 👥 Uso de IA por Colaborador (seção 8).
 * Pesquisa por nome, departamento, empresa, ferramenta, status e risco; ficha individual completa.
 */
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { RegistroDetalhe } from '../components/RegistroDetalhe';
import { RegistrosTabela } from '../components/RegistrosTabela';
import { AlertaBadge, Badge, Card, Info, KpiCard, Modal, PageHeader, RiscoBadge, Tabela, Vazio, cx, inputCls, tdCls, thCls } from '../components/ui';
import { NIVEIS_RISCO, NIVEL_RISCO_LABEL, NIVEL_RISCO_ORDEM, PERFIL_LABEL, STATUS_INCIDENTE_ABERTO, STATUS_PENDENTES, STATUS_USO } from '../domain/catalogs';
import type { NivelRisco, Usuario } from '../domain/types';
import { situacaoTreinamento, statusParticipacao, SituacaoTreinamento } from '../services/derived';
import { nivelEfetivo } from '../services/riskEngine';
import { useGovernanca } from '../state/GovernanceContext';
import { formatarData } from '../utils/dates';

const TOM_TREINO: Record<SituacaoTreinamento, 'verde' | 'amarelo' | 'laranja'> = { Treinado: 'verde', Pendente: 'laranja', Vencido: 'amarelo' };

export const ColaboradoresPage: React.FC = () => {
  const { db, ix, usuariosEscopo, registros, incidentesEscopo, alertas, hoje } = useGovernanca();
  const [q, setQ] = useState('');
  const [dep, setDep] = useState('');
  const [emp, setEmp] = useState('');
  const [fer, setFer] = useState('');
  const [status, setStatus] = useState('');
  const [risco, setRisco] = useState('');
  const [somenteIA, setSomenteIA] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);

  const linhas = useMemo(() => usuariosEscopo.map(u => {
    const regs = registros.filter(r => r.colaboradorId === u.id);
    const ativos = regs.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado');
    const maior = ativos.reduce<NivelRisco | undefined>((m, r) => (!m || NIVEL_RISCO_ORDEM[nivelEfetivo(r)] > NIVEL_RISCO_ORDEM[m] ? nivelEfetivo(r) : m), undefined);
    return {
      u, regs, ativos, maior,
      ferramentas: [...new Set(ativos.map(r => r.ferramentaId))],
      treino: situacaoTreinamento(db, u, hoje),
      pendencias: alertas.filter(a => !a.reconhecido && ((a.entidade === 'Colaborador' && a.registroId === u.id) || (a.registroId && regs.some(r => r.id === a.registroId)))).length,
      incidentes: incidentesEscopo.filter(i => i.colaboradorId === u.id).length,
    };
  }), [usuariosEscopo, registros, db, hoje, alertas, incidentesEscopo]);

  const filtradas = linhas.filter(l => {
    const t = q.trim().toLowerCase();
    if (somenteIA && !l.ativos.length) return false;
    if (t && ![l.u.nome, l.u.cargo, l.u.email].some(v => v.toLowerCase().includes(t))) return false;
    if (dep && l.u.departamentoId !== dep) return false;
    if (emp && l.u.empresaId !== emp) return false;
    if (fer && !l.regs.some(r => r.ferramentaId === fer)) return false;
    if (status && !l.regs.some(r => r.status === status)) return false;
    if (risco && !l.regs.some(r => nivelEfetivo(r) === risco)) return false;
    return true;
  });

  const usuariosIA = linhas.filter(l => l.ativos.length);
  const ficha = aberto ? linhas.find(l => l.u.id === aberto) : undefined;

  const sel = (id: string, valor: string, set: (v: string) => void, vazio: string, opcoes: [string, string][]) => (
    <select id={id} className={inputCls} value={valor} onChange={e => set(e.target.value)}>
      <option value="">{vazio}</option>{opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Orientar" titulo="Uso de IA por Colaborador" subtitulo="Quem usa IA, com quais ferramentas, para quê, com qual risco e com qual preparo." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard rotulo="Colaboradores que usam IA" valor={usuariosIA.length} detalhe={`de ${linhas.length} no seu escopo`} tom="navy" />
        <KpiCard rotulo="Treinados" valor={usuariosIA.filter(l => l.treino === 'Treinado').length} tom="verde" />
        <KpiCard rotulo="Sem treinamento em dia" valor={usuariosIA.filter(l => l.treino !== 'Treinado').length} tom="laranja" />
        <KpiCard rotulo="Com uso de alto risco" valor={usuariosIA.filter(l => l.maior && NIVEL_RISCO_ORDEM[l.maior] >= 2).length} tom="vermelho" />
      </div>

      <Card corpo="p-0">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 p-4">
          <div className="relative sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input id="col-busca" className={cx(inputCls, 'pl-9')} placeholder="Nome, cargo ou e-mail" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {sel('col-dep', dep, setDep, 'Departamento', db.departamentos.filter(d => usuariosEscopo.some(u => u.departamentoId === d.id)).map(d => [d.id, d.nome]))}
          {sel('col-emp', emp, setEmp, 'Empresa', db.empresas.map(e => [e.id, e.nome]))}
          {sel('col-fer', fer, setFer, 'Ferramenta', db.ferramentas.map(f => [f.id, f.nome]))}
          {sel('col-st', status, setStatus, 'Status do uso', STATUS_USO.map(s => [s, s]))}
          {sel('col-risco', risco, setRisco, 'Risco', NIVEIS_RISCO.map(n => [n, NIVEL_RISCO_LABEL[n]]))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 px-4 pb-3">
          <input id="col-soia" type="checkbox" className="accent-[#1d4e89]" checked={somenteIA} onChange={e => setSomenteIA(e.target.checked)} />
          Mostrar apenas quem usa IA
        </label>
        {filtradas.length === 0 ? <Vazio texto="Nenhum colaborador encontrado." /> : (
          <Tabela minWidth={960} cabecalho={<>
            <th className={thCls}>Colaborador</th><th className={thCls}>Área / empresa</th><th className={thCls}>Ferramentas</th>
            <th className={thCls}>Utilizações</th><th className={thCls}>Maior risco</th><th className={thCls}>Treinamento</th>
            <th className={thCls}>Pendências</th><th className={thCls}>Incidentes</th>
          </>}>
            {filtradas.map(l => (
              <tr key={l.u.id} className="hover:bg-gov-light/40 cursor-pointer" tabIndex={0} onClick={() => setAberto(l.u.id)} onKeyDown={e => e.key === 'Enter' && setAberto(l.u.id)}>
                <td className={tdCls}><p className="font-semibold text-slate-800">{l.u.nome}</p><p className="text-xs text-slate-500">{l.u.cargo}</p></td>
                <td className={tdCls}><p>{ix.departamentos.get(l.u.departamentoId)?.nome}</p><p className="text-xs text-slate-500">{ix.empresas.get(l.u.empresaId)?.nome}</p></td>
                <td className={cx(tdCls, 'text-xs')}>{l.ferramentas.map(id => ix.ferramentas.get(id)?.nome).join(', ') || '—'}</td>
                <td className={cx(tdCls, 'tabular-nums')}>{l.ativos.length}<span className="text-xs text-slate-500"> ativas / {l.regs.length}</span></td>
                <td className={tdCls}>{l.maior ? <RiscoBadge nivel={l.maior} /> : '—'}</td>
                <td className={tdCls}><Badge tom={TOM_TREINO[l.treino]}>{l.treino}</Badge></td>
                <td className={cx(tdCls, 'tabular-nums', l.pendencias && 'text-amber-800 font-semibold')}>{l.pendencias}</td>
                <td className={cx(tdCls, 'tabular-nums', l.incidentes && 'text-red-700 font-semibold')}>{l.incidentes}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Card>

      {ficha && <FichaColaborador u={ficha.u} onFechar={() => setAberto(null)} onAbrirRegistro={setRegistroAberto} />}
      {registroAberto && <RegistroDetalhe registroId={registroAberto} onFechar={() => setRegistroAberto(null)} />}
    </div>
  );
};

const FichaColaborador: React.FC<{ u: Usuario; onFechar: () => void; onAbrirRegistro: (id: string) => void }> = ({ u, onFechar, onAbrirRegistro }) => {
  const { db, ix, registros, incidentesEscopo, alertas, hoje } = useGovernanca();
  const regs = registros.filter(r => r.colaboradorId === u.id);
  const ativos = regs.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado');
  const revisoes = regs.map(r => r.ultimaRevisao).filter(Boolean).sort() as string[];
  const participacoes = db.participacoes.filter(p => p.colaboradorId === u.id);
  const pendencias = alertas.filter(a => !a.reconhecido && ((a.entidade === 'Colaborador' && a.registroId === u.id) || (a.registroId && regs.some(r => r.id === a.registroId))));
  const incidentes = incidentesEscopo.filter(i => i.colaboradorId === u.id);

  return (
    <Modal aberto largura="xl" onFechar={onFechar} titulo={u.nome} subtitulo={`${u.cargo} · ${ix.departamentos.get(u.departamentoId)?.nome} · ${ix.empresas.get(u.empresaId)?.nome}`}>
      <div className="space-y-5">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Info rotulo="Ferramentas utilizadas">{[...new Set(ativos.map(r => ix.ferramentas.get(r.ferramentaId)?.nome))].join(', ') || '—'}</Info>
          <Info rotulo="Finalidades">{[...new Set(regs.map(r => r.finalidade))].join(', ') || '—'}</Info>
          <Info rotulo="Processos">{[...new Set(regs.map(r => r.processo))].join(', ') || '—'}</Info>
          <Info rotulo="Data de cadastro">{formatarData(u.dataCadastro)}</Info>
          <Info rotulo="Perfil de acesso">{PERFIL_LABEL[u.perfil]}</Info>
          <Info rotulo="E-mail">{u.email}</Info>
          <Info rotulo="Aprovações pendentes">{regs.filter(r => STATUS_PENDENTES.includes(r.status)).length}</Info>
          <Info rotulo="Última revisão">{formatarData(revisoes[revisoes.length - 1])}</Info>
        </dl>

        <section>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Utilizações e aprovações</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden"><RegistrosTabela registros={regs} onAbrir={onAbrirRegistro} vazio="Sem utilizações registradas." /></div>
        </section>

        <div className="grid md:grid-cols-3 gap-4">
          <Card titulo={`Treinamentos (${situacaoTreinamento(db, u, hoje)})`} corpo="px-5 pb-4 pt-2">
            <ul className="space-y-1.5 text-sm">
              {db.treinamentos.map(t => {
                const p = participacoes.find(x => x.treinamentoId === t.id);
                const st = p ? statusParticipacao(p, hoje) : t.obrigatorio ? 'Pendente' : undefined;
                if (!st) return null;
                return (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span>{t.titulo}{t.obrigatorio && <span className="text-[10px] text-red-700 font-bold"> OBRIG.</span>}</span>
                    <Badge tom={st === 'Concluído' ? 'verde' : st === 'Vencido' ? 'amarelo' : 'laranja'}>{st}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card titulo={`Pendências (${pendencias.length})`} corpo="px-5 pb-4 pt-2">
            <ul className="space-y-1.5 text-sm">
              {pendencias.map(a => <li key={a.chave} className="flex gap-2 items-start"><AlertaBadge nivel={a.nivel} /><span>{a.titulo}</span></li>)}
              {!pendencias.length && <li className="text-slate-500">Nenhuma pendência.</li>}
            </ul>
          </Card>
          <Card titulo={`Incidentes (${incidentes.length})`} corpo="px-5 pb-4 pt-2">
            <ul className="space-y-1.5 text-sm">
              {incidentes.map(i => <li key={i.id}><span className="font-mono text-xs text-gov-blue">{i.codigo}</span> {i.tipo} <Badge tom={STATUS_INCIDENTE_ABERTO.includes(i.status) ? 'laranja' : 'verde'}>{i.status}</Badge></li>)}
              {!incidentes.length && <li className="text-slate-500">Nenhum incidente.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </Modal>
  );
};
