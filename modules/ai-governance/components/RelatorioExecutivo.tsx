/**
 * Relatório Executivo (seção 22): resumo textual gerado a partir dos dados,
 * com exportação em CSV e JSON. PDF e Excel estão previstos (a estrutura
 * `secoes` já é o insumo para esses formatos).
 */
import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { CATEGORIA_LABEL, NIVEIS_RISCO, NIVEL_RISCO_LABEL, STATUS_INCIDENTE_ABERTO } from '../domain/catalogs';
import { calcularGraficos, calcularIndicadores, calcularPilares, exposicaoPorDepartamento, filtrosAtivos } from '../services/metrics';
import { exportarCsv, exportarJson } from '../services/export';
import { useGovernanca } from '../state/GovernanceContext';
import { formatarData } from '../utils/dates';
import { Botao, Modal } from './ui';

interface Secao { titulo: string; linhas: [string, string | number][]; texto?: string }

export const RelatorioExecutivo: React.FC<{ onFechar: () => void }> = ({ onFechar }) => {
  const { db, ix, hoje, registrosFiltrados, incidentesFiltrados, usuariosEscopo, alertas, filtros, usuario } = useGovernanca();

  const secoes = useMemo<Secao[]>(() => {
    const ind = calcularIndicadores(db, registrosFiltrados, incidentesFiltrados, hoje);
    const gr = calcularGraficos(db, registrosFiltrados, hoje, ix);
    const ativos = alertas.filter(a => !a.reconhecido);
    const pil = calcularPilares(db, registrosFiltrados, usuariosEscopo, incidentesFiltrados, ativos, hoje);
    const exp = exposicaoPorDepartamento(db, registrosFiltrados, ix);
    const pctT = pil.orientar.colaboradores ? Math.round((pil.orientar.treinados / pil.orientar.colaboradores) * 100) : 0;
    const pctAut = ind.totalRegistros ? Math.round((ind.homologadas / ind.totalRegistros) * 100) : 0;
    const ev = gr.evolucaoMensal;
    const cresc = ev.length > 3 ? ev[ev.length - 1].acumulado - ev[ev.length - 4].acumulado : 0;

    const resumo = [
      `${ind.totalUsuarios} colaboradores de ${ind.totalDepartamentos} áreas utilizam IA em ${ind.totalRegistros} utilizações registradas; ${pctAut}% estão autorizadas e sob controle.`,
      `${ind.aguardandoAprovacao} aguardam aprovação e ${ind.altoRisco} utilizações ativas são de risco Alto ou Crítico.`,
      exp[0] ? `A maior exposição está em ${exp[0].nome}.` : '',
      `${pctT}% dos usuários de IA estão com os treinamentos obrigatórios em dia.`,
      `${ind.incidentesAbertos} incidente(s) em aberto e ${ativos.filter(a => a.nivel === 'CRITICO').length} alerta(s) crítico(s).`,
      `Nos últimos 3 meses foram registradas ${cresc} novas utilizações.`,
    ].filter(Boolean).join(' ');

    return [
      { titulo: 'Resumo executivo', texto: resumo, linhas: [['Data de referência', formatarData(hoje)], ['Emitido por', usuario.nome], ['Filtros aplicados', filtrosAtivos(filtros) || 'Nenhum']] },
      { titulo: 'Usuários e áreas', linhas: [['Usuários de IA', ind.totalUsuarios], ['Departamentos utilizando IA', ind.totalDepartamentos], ...gr.porDepartamento.map(s => [`Utilizações — ${s.nome}`, s.valor] as [string, number])] },
      { titulo: 'Ferramentas', linhas: [['Ferramentas cadastradas', ind.totalFerramentas], ...db.ferramentas.map(f => [`${f.nome} (${CATEGORIA_LABEL[f.categoria]})`, gr.porFerramenta.find(s => s.nome === f.nome)?.valor ?? 0] as [string, number])] },
      { titulo: 'Casos de uso', linhas: [['Utilizações registradas', ind.totalRegistros], ['Casos no catálogo', db.casosUso.length], ...gr.porFinalidade.slice(0, 6).map(s => [`Finalidade — ${s.nome}`, s.valor] as [string, number])] },
      { titulo: 'Riscos', linhas: [...NIVEIS_RISCO.map(n => [`Utilizações de risco ${NIVEL_RISCO_LABEL[n]}`, gr.porRisco.find(s => s.nome === NIVEL_RISCO_LABEL[n])?.valor ?? 0] as [string, number]), ['Riscos corporativos registrados', db.riscos.length], ['Riscos Alto/Crítico no registro', db.riscos.filter(r => r.nivel === 'ALTO' || r.nivel === 'CRITICO').length]] },
      { titulo: 'Aprovações', linhas: [['Autorizadas', ind.homologadas], ['Aguardando aprovação', ind.aguardandoAprovacao], ['Com restrição / suspensas', ind.comRestricao], ['Não aprovadas', registrosFiltrados.filter(r => r.status === 'Não aprovado').length]] },
      { titulo: 'Pendências', linhas: [['Revisões vencidas', ind.pendenciasRevisao], ['Alertas ativos', ativos.length], ...(['CRITICO', 'ALERTA', 'ATENCAO', 'INFORMATIVO'] as const).map(n => [`Alertas — ${n.charAt(0) + n.slice(1).toLowerCase()}`, ativos.filter(a => a.nivel === n).length] as [string, number])] },
      { titulo: 'Incidentes', linhas: [['Registrados', ind.incidentesTotal], ['Em aberto', ind.incidentesAbertos], ...incidentesFiltrados.filter(i => STATUS_INCIDENTE_ABERTO.includes(i.status)).map(i => [`${i.codigo} — ${i.tipo}`, i.status] as [string, string])] },
      { titulo: 'Treinamentos', linhas: [['Usuários de IA', pil.orientar.colaboradores], ['Treinados', `${pil.orientar.treinados} (${pctT}%)`], ['Pendentes', pil.orientar.pendentes], ['Vencidos', pil.orientar.vencidos]] },
      { titulo: 'Evolução', linhas: ev.map(e => [e.mes, `${e.acumulado} acumuladas (+${e.registros})`] as [string, string]) },
    ];
  }, [db, ix, hoje, registrosFiltrados, incidentesFiltrados, usuariosEscopo, alertas, filtros, usuario]);

  const csv = () => exportarCsv<{ s: string; k: string; v: string | number }>(secoes.flatMap(s => [...(s.texto ? [{ s: s.titulo, k: 'Resumo', v: s.texto }] : []), ...s.linhas.map(([k, v]) => ({ s: s.titulo, k, v }))]),
    [{ titulo: 'Seção', valor: x => x.s }, { titulo: 'Indicador', valor: x => x.k }, { titulo: 'Valor', valor: x => x.v }], `relatorio-executivo-ia-${hoje}.csv`);

  return (
    <Modal aberto largura="xl" onFechar={onFechar} titulo="Relatório Executivo — Governança e Segurança da IA" subtitulo={`Referência ${formatarData(hoje)} · reflete os filtros globais e o escopo do seu perfil`}
      rodape={<>
        <span className="text-xs text-slate-500 mr-auto self-center">PDF e Excel: previstos para a próxima fase.</span>
        <Botao variante="secundario" icone={<Download className="w-4 h-4" />} onClick={() => exportarJson({ geradoEm: hoje, secoes }, `relatorio-executivo-ia-${hoje}.json`)}>JSON</Botao>
        <Botao icone={<Download className="w-4 h-4" />} onClick={csv}>Exportar CSV</Botao>
      </>}>
      <article className="space-y-5">
        {secoes.map(s => (
          <section key={s.titulo}>
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-gov-golddeep border-b border-slate-200 pb-1 mb-2">{s.titulo}</h4>
            {s.texto && <p className="text-sm text-slate-800 leading-relaxed max-w-3xl mb-2">{s.texto}</p>}
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
              {s.linhas.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-sm py-0.5 border-b border-dotted border-slate-200">
                  <dt className="text-slate-600">{k}</dt><dd className="font-semibold tabular-nums text-slate-900 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </article>
    </Modal>
  );
};
