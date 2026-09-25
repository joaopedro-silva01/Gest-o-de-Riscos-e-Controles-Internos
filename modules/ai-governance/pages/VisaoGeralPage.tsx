/**
 * 🏠 Visão Geral — PAINEL EXECUTIVO (seções 6, 23 e 24).
 * Objetivo: a Diretoria entende o cenário de governança da IA em poucos segundos.
 * Ordem de leitura: pilares → pontos de atenção → indicadores → gráficos.
 */
import React, { useMemo, useState } from 'react';
import { ArrowRight, Download, FileText, Users, Building2, Bot, ClipboardList, BadgeCheck, Hourglass, ShieldAlert, AlertTriangle, CalendarClock, Siren } from 'lucide-react';
import { BarrasH, BarrasV, ChartCard, Evolucao } from '../components/charts';
import { FiltrosGlobaisBar } from '../components/FiltrosGlobaisBar';
import { RelatorioExecutivo } from '../components/RelatorioExecutivo';
import { Botao, Card, KpiCard, PageHeader, cx } from '../components/ui';
import type { PaginaId } from '../domain/types';
import { calcularGraficos, calcularIndicadores, calcularPilares, exposicaoPorDepartamento, filtrosAtivos } from '../services/metrics';
import { exportarCsv } from '../services/export';
import { useGovernanca } from '../state/GovernanceContext';
import { formatarData } from '../utils/dates';

type Tom = 'vermelho' | 'laranja' | 'verde' | 'azul';
interface PontoAtencao { tom: Tom; texto: string; destino: PaginaId }

const PONTO_COR: Record<Tom, string> = {
  vermelho: 'bg-red-600',
  laranja: 'bg-orange-500',
  verde: 'bg-emerald-600',
  azul: 'bg-gov-sky',
};
const PONTO_ROTULO: Record<Tom, string> = { vermelho: 'Crítico', laranja: 'Atenção', verde: 'Positivo', azul: 'Informativo' };

export const VisaoGeralPage: React.FC = () => {
  const { db, ix, hoje, registrosFiltrados, incidentesFiltrados, usuariosEscopo, alertas, navegar, filtros, pode, setFiltros } = useGovernanca();

  const ind = useMemo(() => calcularIndicadores(db, registrosFiltrados, incidentesFiltrados, hoje), [db, registrosFiltrados, incidentesFiltrados, hoje]);
  const gr = useMemo(() => calcularGraficos(db, registrosFiltrados, hoje, ix), [db, registrosFiltrados, hoje, ix]);
  // Alertas respeitam os filtros globais: sem filtro, todos; com filtro, apenas os ligados
  // aos registros/áreas/colaboradores do recorte (alertas globais, como política, permanecem).
  const [relatorio, setRelatorio] = useState(false);
  const alertasAtivos = useMemo(() => {
    const ativos = alertas.filter(a => !a.reconhecido);
    if (!filtrosAtivos(filtros)) return ativos;
    const regs = new Set(registrosFiltrados.map(r => r.id));
    const pessoas = new Set(registrosFiltrados.map(r => r.colaboradorId));
    const deptos = new Set(registrosFiltrados.map(r => ix.usuarios.get(r.colaboradorId)?.departamentoId));
    const incs = new Set(incidentesFiltrados.map(i => i.id));
    return ativos.filter(a => {
      if (a.entidade === 'Registro de uso') return !!a.registroId && regs.has(a.registroId);
      if (a.entidade === 'Colaborador') return !!a.registroId && pessoas.has(a.registroId);
      if (a.entidade === 'Incidente') return !!a.registroId && incs.has(a.registroId);
      if (a.departamentoId) return deptos.has(a.departamentoId);
      return true;
    });
  }, [alertas, filtros, registrosFiltrados, incidentesFiltrados, ix]);
  const pil = useMemo(() => calcularPilares(db, registrosFiltrados, usuariosEscopo, incidentesFiltrados, alertasAtivos, hoje), [db, registrosFiltrados, usuariosEscopo, incidentesFiltrados, alertasAtivos, hoje]);
  const exposicao = useMemo(() => exposicaoPorDepartamento(db, registrosFiltrados, ix).slice(0, 4), [db, registrosFiltrados, ix]);

  // Pontos de atenção gerados das regras (nunca digitados à mão).
  const altoRiscoPendente = alertasAtivos.filter(a => a.chave.startsWith('alto-risco-pendente')).length;
  const semTreino = pil.orientar.pendentes + pil.orientar.vencidos;
  const pctClassificados = ind.totalRegistros ? Math.round((ind.classificados / ind.totalRegistros) * 100) : 0;
  const pctTreinados = pil.orientar.colaboradores ? Math.round((pil.orientar.treinados / pil.orientar.colaboradores) * 100) : 0;
  const pontos: PontoAtencao[] = [
    altoRiscoPendente > 0 && { tom: 'vermelho', texto: `${altoRiscoPendente} utilização(ões) de alto risco aguardando aprovação`, destino: 'aprovacoes' },
    ind.incidentesAbertos > 0 && { tom: 'vermelho', texto: `${ind.incidentesAbertos} incidente(s) de IA em aberto`, destino: 'incidentes' },
    alertasAtivos.some(a => a.chave.startsWith('sensivel-sem-autorizacao')) && { tom: 'vermelho', texto: 'Uso autorizado com dado sensível sem autorização formal', destino: 'riscos-alertas' },
    semTreino > 0 && { tom: 'laranja', texto: `${semTreino} colaborador(es) que usam IA sem treinamento obrigatório em dia`, destino: 'treinamentos' },
    ind.pendenciasRevisao > 0 && { tom: 'laranja', texto: `${ind.pendenciasRevisao} caso(s) de uso com revisão vencida`, destino: 'governanca' },
    alertasAtivos.some(a => a.chave.startsWith('ferramenta-nao-homologada')) && { tom: 'laranja', texto: 'Ferramentas não homologadas em uso ou com ocorrências', destino: 'ferramentas' },
    { tom: pctClassificados >= 90 ? 'verde' : 'laranja', texto: `${pctClassificados}% das utilizações classificadas quanto ao risco`, destino: 'governanca' },
    { tom: ind.homologadas >= ind.totalRegistros / 2 ? 'verde' : 'azul', texto: `${ind.homologadas} de ${ind.totalRegistros} utilizações autorizadas e sob controle`, destino: 'governanca' },
  ].filter(Boolean) as PontoAtencao[];

  const exportarResumo = () => {
    const linhas: [string, string | number][] = [
      ['Data de referência', formatarData(hoje)],
      ['Filtros ativos', filtrosAtivos(filtros)],
      ['Usuários de IA', ind.totalUsuarios],
      ['Departamentos utilizando IA', ind.totalDepartamentos],
      ['Ferramentas cadastradas', ind.totalFerramentas],
      ['Utilizações registradas', ind.totalRegistros],
      ['Utilizações autorizadas', ind.homologadas],
      ['Aguardando aprovação', ind.aguardandoAprovacao],
      ['Com restrição / suspensas', ind.comRestricao],
      ['Alto risco (ativas)', ind.altoRisco],
      ['Revisões vencidas', ind.pendenciasRevisao],
      ['Incidentes abertos', ind.incidentesAbertos],
      ['Colaboradores treinados (%)', pctTreinados],
      ['Alertas ativos', alertasAtivos.length],
      ...gr.porDepartamento.map(s => [`Utilizações — ${s.nome}`, s.valor] as [string, number]),
      ...gr.porFerramenta.map(s => [`Ferramenta — ${s.nome}`, s.valor] as [string, number]),
      ...gr.porRisco.map(s => [`Risco — ${s.nome}`, s.valor] as [string, number]),
    ];
    exportarCsv(linhas, [{ titulo: 'Indicador', valor: l => l[0] }, { titulo: 'Valor', valor: l => l[1] }], `painel-executivo-ia-${hoje}.csv`);
  };

  const filtrarDepartamento = (nomeDep: string) => {
    const d = db.departamentos.find(x => x.nome === nomeDep);
    if (d) setFiltros({ ...filtros, departamentoId: d.id });
  };
  const filtrarFerramenta = (nomeF: string) => {
    const f = db.ferramentas.find(x => x.nome === nomeF);
    if (f) setFiltros({ ...filtros, ferramentaId: f.id });
  };

  const pilares = [
    { nome: 'HOMOLOGAR', destino: 'ferramentas' as PaginaId, principal: `${pil.homologar.ferramentas} ferramentas`, linhas: [`${pil.homologar.homologadas} homologadas`, `${pil.homologar.emAnalise} em análise / mediante aprovação`, `${pil.homologar.restritas} restritas`], alerta: pil.homologar.restritas > 0 },
    { nome: 'ORIENTAR', destino: 'treinamentos' as PaginaId, principal: `${pil.orientar.colaboradores} colaboradores`, linhas: [`${pil.orientar.treinados} treinados (${pctTreinados}%)`, `${pil.orientar.pendentes} pendentes`, `${pil.orientar.vencidos} vencidos`], alerta: semTreino > 0 },
    { nome: 'CONTROLAR', destino: 'governanca' as PaginaId, principal: `${pil.controlar.casos} casos de uso ativos`, linhas: [`${pil.controlar.controlados} controlados`, `${pil.controlar.pendentes} pendentes de controle`], alerta: pil.controlar.pendentes > 0 },
    { nome: 'MONITORAR', destino: 'riscos-alertas' as PaginaId, principal: `${pil.monitorar.alertas} alertas ativos`, linhas: [`${pil.monitorar.criticos} críticos · ${alertasAtivos.filter(a => a.nivel === 'ALERTA').length} de nível alerta`, `${pil.monitorar.incidentesAbertos} incidentes abertos`], alerta: alertasAtivos.some(a => a.nivel === 'CRITICO' || a.nivel === 'ALERTA') },
    { nome: 'EVOLUIR', destino: 'riscos-alertas' as PaginaId, principal: `${pil.evoluir.melhorias} melhorias identificadas`, linhas: [`${pil.evoluir.implantadas} implantadas`, `${pil.evoluir.emImplantacao} em implantação`], alerta: false },
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Faixa institucional */}
      <div className="rounded-2xl bg-gov-navy text-white p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-gov-blue/60 to-transparent pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-gov-gold">Painel Executivo</p>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">Governança e Segurança da IA</h2>
            <p className="text-sm text-blue-100/90 mt-1 max-w-2xl">Onde a IA é usada, por quem, para quê, com quais dados, sob quais regras, riscos e controles.</p>
          </div>
          {pode('relatorio.exportar') && (
            <div className="flex flex-wrap gap-2">
              <Botao variante="dourado" icone={<FileText className="w-4 h-4" />} onClick={() => setRelatorio(true)}>Relatório executivo</Botao>
              <Botao variante="secundario" className="!bg-transparent !text-white !border-white/40 hover:!bg-white/10" icone={<Download className="w-4 h-4" />} onClick={exportarResumo}>Indicadores (CSV)</Botao>
            </div>
          )}
        </div>
      </div>

      <FiltrosGlobaisBar />

      {/* Cinco pilares */}
      <section aria-label="Pilares da governança" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {pilares.map((p, i) => (
          <button key={p.nome} onClick={() => navegar(p.destino)} className="group text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-gov-sky transition-all relative">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-bold tracking-[0.14em] text-gov-golddeep whitespace-nowrap">{String(i + 1).padStart(2, '0')} · {p.nome}</span>
              <span className={cx('text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap', p.alerta ? 'bg-orange-50 text-orange-800' : 'bg-emerald-50 text-emerald-800')}>{p.alerta ? 'Atenção' : 'Em dia'}</span>
            </div>
            <p className="text-lg font-bold text-gov-navy mt-2">{p.principal}</p>
            <ul className="mt-1 space-y-0.5">{p.linhas.map(l => <li key={l} className="text-xs text-slate-600">{l}</li>)}</ul>
            {i < pilares.length - 1 && <ArrowRight className="hidden xl:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gov-gold bg-[#f3f4f6] rounded-full z-10" />}
          </button>
        ))}
      </section>

      {/* Pontos de atenção + exposição */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card titulo="Principais pontos de atenção" subtitulo="Gerados automaticamente a partir das regras de governança" className="lg:col-span-2" corpo="p-3">
          <ul className="divide-y divide-slate-100">
            {pontos.map(p => (
              <li key={p.texto}>
                <button onClick={() => navegar(p.destino)} className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-slate-50 rounded-lg">
                  <span className={cx('w-2.5 h-2.5 rounded-full shrink-0', PONTO_COR[p.tom])} aria-hidden />
                  <span className="text-[10px] font-bold uppercase w-16 shrink-0 text-slate-500">{PONTO_ROTULO[p.tom]}</span>
                  <span className="text-sm text-slate-800 flex-1">{p.texto}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card titulo="Áreas com maior exposição" subtitulo="Soma ponderada do risco das utilizações ativas (Baixo 1 · Médio 2 · Alto 4 · Crítico 8)">
          {exposicao.length ? (
            <ul className="space-y-3">
              {exposicao.map(e => {
                const max = exposicao[0].valor || 1;
                return (
                  <li key={e.nome}>
                    <div className="flex justify-between text-sm"><span className="text-slate-700">{e.nome}</span><span className="font-bold tabular-nums">{e.valor}</span></div>
                    <div className="h-2 bg-slate-100 rounded-full mt-1"><div className="h-2 rounded-full bg-gov-blue" style={{ width: `${(e.valor / max) * 100}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-slate-500">Sem utilizações ativas.</p>}
        </Card>
      </div>

      {/* KPIs */}
      <section aria-label="Indicadores" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard rotulo="Usuários de IA" valor={ind.totalUsuarios} icone={<Users className="w-4 h-4" />} tom="navy" onClick={() => navegar('colaboradores')} />
        <KpiCard rotulo="Departamentos usando IA" valor={ind.totalDepartamentos} icone={<Building2 className="w-4 h-4" />} tom="navy" onClick={() => navegar('departamentos')} />
        <KpiCard rotulo="Ferramentas cadastradas" valor={ind.totalFerramentas} icone={<Bot className="w-4 h-4" />} tom="navy" onClick={() => navegar('ferramentas')} />
        <KpiCard rotulo="Utilizações registradas" valor={ind.totalRegistros} icone={<ClipboardList className="w-4 h-4" />} tom="navy" onClick={() => navegar('governanca')} />
        <KpiCard rotulo="Utilizações autorizadas" valor={ind.homologadas} detalhe="Aprovadas / em monitoramento" icone={<BadgeCheck className="w-4 h-4" />} tom="verde" />
        <KpiCard rotulo="Aguardando aprovação" valor={ind.aguardandoAprovacao} icone={<Hourglass className="w-4 h-4" />} tom="amarelo" onClick={() => navegar('aprovacoes')} />
        <KpiCard rotulo="Com restrição / suspensas" valor={ind.comRestricao} icone={<ShieldAlert className="w-4 h-4" />} tom="dourado" />
        <KpiCard rotulo="Alto risco (ativas)" valor={ind.altoRisco} detalhe="Alto + Crítico" icone={<AlertTriangle className="w-4 h-4" />} tom="vermelho" />
        <KpiCard rotulo="Pendências de revisão" valor={ind.pendenciasRevisao} icone={<CalendarClock className="w-4 h-4" />} tom="laranja" />
        <KpiCard rotulo="Incidentes registrados" valor={ind.incidentesTotal} detalhe={`${ind.incidentesAbertos} em aberto`} icone={<Siren className="w-4 h-4" />} tom="vermelho" onClick={() => navegar('incidentes')} />
      </section>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard titulo="Utilização por departamento" subtitulo="Clique numa barra para filtrar" dados={gr.porDepartamento}><BarrasH dados={gr.porDepartamento} onClick={filtrarDepartamento} larguraRotulo={160} /></ChartCard>
        <ChartCard titulo="Utilização por ferramenta" subtitulo="Clique numa barra para filtrar" dados={gr.porFerramenta}><BarrasH dados={gr.porFerramenta} onClick={filtrarFerramenta} larguraRotulo={150} /></ChartCard>
        <ChartCard titulo="Utilização por empresa do Grupo" dados={gr.porEmpresa}><BarrasH dados={gr.porEmpresa} /></ChartCard>
        <ChartCard titulo="Distribuição por nível de risco" subtitulo="Nível efetivo (ajustes manuais considerados)" dados={gr.porRisco}><BarrasV dados={gr.porRisco} /></ChartCard>
        <ChartCard titulo="Distribuição por status" dados={gr.porStatus}><BarrasH dados={gr.porStatus} larguraRotulo={150} /></ChartCard>
        <ChartCard titulo="Tipos de dados utilizados" subtitulo="Uma utilização pode envolver vários tipos" dados={gr.tiposDado}><BarrasH dados={gr.tiposDado} larguraRotulo={160} /></ChartCard>
        <ChartCard titulo="Homologadas × não homologadas" subtitulo="Pela categoria da ferramenta utilizada" dados={gr.homologadasVsNao}><BarrasH dados={gr.homologadasVsNao} larguraRotulo={150} /></ChartCard>
        <ChartCard titulo="Evolução mensal da utilização" subtitulo="Utilizações acumuladas — últimos 12 meses" dados={gr.evolucaoMensal.map(e => ({ nome: e.mes, valor: e.acumulado }))}><Evolucao dados={gr.evolucaoMensal} /></ChartCard>
        <ChartCard titulo="Utilizações por finalidade" dados={gr.porFinalidade}><BarrasH dados={gr.porFinalidade} larguraRotulo={150} /></ChartCard>
        <ChartCard titulo="Processos mais dependentes de IA" subtitulo="Top 8 por número de utilizações" dados={gr.processos} className="md:col-span-2 xl:col-span-3"><BarrasH dados={gr.processos} larguraRotulo={200} /></ChartCard>
      </div>
      {relatorio && <RelatorioExecutivo onFechar={() => setRelatorio(false)} />}
    </div>
  );
};
