/**
 * Central de Alertas de Governança (seção 15).
 *
 * Alertas NÃO são cadastrados manualmente: são derivados das regras abaixo a
 * cada mudança de estado. Assim nunca ficam desatualizados. Apenas o
 * "reconhecimento" do alerta é persistido (AlertaEstado).
 *
 * Para incluir uma regra nova basta acrescentar um bloco em `gerarAlertas`
 * com uma `chave` estável (usada para reconhecimento e deduplicação).
 */
import { CATEGORIA_LABEL, NIVEL_RISCO_LABEL, NIVEL_RISCO_ORDEM, NIVEL_ALERTA_ORDEM, STATUS_AUTORIZADOS, STATUS_INCIDENTE_ABERTO, STATUS_PENDENTES } from '../domain/catalogs';
import type { Alerta, GovernanceDB, ISODate } from '../domain/types';
import { addDias, diasEntre, formatarData } from '../utils/dates';
import { criarIndices, departamentoDoIncidente, departamentoDoRegistro, situacaoTreinamento, usuariosDeIA } from './derived';
import { nivelEfetivo } from './riskEngine';

export const gerarAlertas = (db: GovernanceDB, hoje: ISODate): Alerta[] => {
  const ix = criarIndices(db);
  const alertas: Alerta[] = [];
  const ativos = db.registrosUso.filter(r => r.status !== 'Encerrado' && r.status !== 'Não aprovado');

  // 1. Ferramenta não homologada identificada (em registros ativos ou incidentes).
  for (const f of db.ferramentas.filter(f => f.categoria === 'NAO_HOMOLOGADA')) {
    const usos = ativos.filter(r => r.ferramentaId === f.id);
    const incid = db.incidentes.filter(i => i.ferramentaId === f.id && STATUS_INCIDENTE_ABERTO.includes(i.status));
    if (usos.length || incid.length) {
      alertas.push({
        chave: `ferramenta-nao-homologada:${f.id}:${usos.length}:${incid.length}`,
        nivel: 'ALERTA',
        titulo: `Ferramenta não homologada identificada: ${f.nome}`,
        descricao: `${usos.length} registro(s) de uso e ${incid.length} incidente(s) aberto(s) envolvendo ferramenta "${CATEGORIA_LABEL[f.categoria]}".`,
        entidade: 'Ferramenta',
        registroId: f.id,
        destino: 'ferramentas',
      });
    }
  }

  for (const r of ativos) {
    const nivel = nivelEfetivo(r);
    const depto = departamentoDoRegistro(ix, r);
    const ferramenta = ix.ferramentas.get(r.ferramentaId);

    // 2. Utilização de alto risco aguardando aprovação.
    if (STATUS_PENDENTES.includes(r.status) && NIVEL_RISCO_ORDEM[nivel] >= NIVEL_RISCO_ORDEM.ALTO) {
      alertas.push({
        chave: `alto-risco-pendente:${r.id}`,
        nivel: nivel === 'CRITICO' ? 'CRITICO' : 'ALERTA',
        titulo: `Utilização de risco ${NIVEL_RISCO_LABEL[nivel]} aguardando aprovação`,
        descricao: `${r.codigo} — ${r.atividade} (${ferramenta?.nome ?? 'ferramenta'}).`,
        entidade: 'Registro de uso', registroId: r.id, departamentoId: depto, destino: 'aprovacoes',
      });
    }

    // 3. Revisão vencida.
    if (STATUS_AUTORIZADOS.includes(r.status) && r.proximaRevisao && r.proximaRevisao < hoje) {
      alertas.push({
        chave: `revisao-vencida:${r.id}:${r.proximaRevisao}`,
        nivel: 'ATENCAO',
        titulo: 'Revisão de caso de uso vencida',
        descricao: `${r.codigo} — revisão prevista para ${formatarData(r.proximaRevisao)} (${diasEntre(r.proximaRevisao, hoje)} dias de atraso).`,
        entidade: 'Registro de uso', registroId: r.id, departamentoId: depto, destino: 'governanca',
      });
    }

    // 4. Dado sensível em uso autorizado sem autorização formal.
    if (r.dados.sensivel && STATUS_AUTORIZADOS.includes(r.status) && !r.detalheSensivel?.existeAutorizacao) {
      alertas.push({
        chave: `sensivel-sem-autorizacao:${r.id}`,
        nivel: 'CRITICO',
        titulo: 'Dado sensível sem autorização formal',
        descricao: `${r.codigo} utiliza dado sensível e não possui autorização registrada.`,
        entidade: 'Registro de uso', registroId: r.id, departamentoId: depto, destino: 'governanca',
      });
    }

    // 5. Registro sem responsável pelo processo.
    if (!r.responsavelProcessoId) {
      alertas.push({
        chave: `registro-sem-responsavel:${r.id}`,
        nivel: 'ATENCAO',
        titulo: 'Utilização sem responsável pelo processo',
        descricao: `${r.codigo} — ${r.atividade}.`,
        entidade: 'Registro de uso', registroId: r.id, departamentoId: depto, destino: 'governanca',
      });
    }
  }

  // 6. Caso de uso (catálogo) sem responsável.
  for (const c of db.casosUso.filter(c => c.status !== 'Descontinuado' && !c.responsavelId)) {
    alertas.push({
      chave: `caso-sem-responsavel:${c.id}`,
      nivel: 'ATENCAO',
      titulo: 'Caso de uso sem responsável',
      descricao: `"${c.nome}" não possui responsável definido.`,
      entidade: 'Caso de uso', registroId: c.id, departamentoId: c.departamentoId, destino: 'casos-uso',
    });
  }

  // 7. Colaborador que usa IA sem treinamento obrigatório (ou vencido).
  for (const u of usuariosDeIA(db)) {
    const sit = situacaoTreinamento(db, u, hoje);
    if (sit !== 'Treinado') {
      alertas.push({
        chave: `treinamento:${u.id}:${sit}`,
        nivel: sit === 'Vencido' ? 'ATENCAO' : 'ALERTA',
        titulo: sit === 'Vencido' ? 'Treinamento obrigatório vencido' : 'Colaborador sem treinamento obrigatório',
        descricao: `${u.nome} utiliza IA e está com treinamento ${sit.toLowerCase()}.`,
        entidade: 'Colaborador', registroId: u.id, departamentoId: u.departamentoId, destino: 'treinamentos',
      });
    }
  }

  // 8. Política vencida ou próxima do vencimento.
  for (const p of db.politicas.filter(p => p.status === 'Vigente' || p.status === 'Em revisão')) {
    const limite = addDias(hoje, db.configuracoes.diasAvisoPolitica);
    if (p.vigenciaAte < hoje || p.vigenciaAte <= limite) {
      const vencida = p.vigenciaAte < hoje;
      alertas.push({
        chave: `politica:${p.id}:${p.vigenciaAte}`,
        nivel: vencida ? 'ALERTA' : 'ATENCAO',
        titulo: vencida ? 'Política vencida' : 'Política próxima do vencimento',
        descricao: `"${p.titulo}" v${p.versaoAtual} — vigência até ${formatarData(p.vigenciaAte)}.`,
        entidade: 'Política', registroId: p.id, destino: 'politicas',
      });
    }
  }

  // 9. Incidentes abertos.
  for (const i of db.incidentes.filter(i => STATUS_INCIDENTE_ABERTO.includes(i.status))) {
    alertas.push({
      chave: `incidente:${i.id}:${i.status}`,
      nivel: NIVEL_RISCO_ORDEM[i.impacto] >= NIVEL_RISCO_ORDEM.ALTO ? 'CRITICO' : 'ALERTA',
      titulo: `Incidente ${i.status.toLowerCase()}: ${i.tipo}`,
      descricao: `${i.codigo} — ${i.descricao}`,
      entidade: 'Incidente', registroId: i.id, departamentoId: departamentoDoIncidente(ix, i), destino: 'incidentes',
    });
  }

  // 10. Ferramenta sem revisão recente.
  for (const f of db.ferramentas.filter(f => f.status !== 'Descontinuada')) {
    const dias = f.ultimaRevisao ? diasEntre(f.ultimaRevisao, hoje) : Infinity;
    if (dias > db.configuracoes.diasRevisaoFerramenta) {
      alertas.push({
        chave: `ferramenta-revisao:${f.id}:${f.ultimaRevisao ?? 'nunca'}`,
        nivel: 'INFORMATIVO',
        titulo: 'Ferramenta sem revisão recente',
        descricao: f.ultimaRevisao ? `${f.nome} — última revisão em ${formatarData(f.ultimaRevisao)}.` : `${f.nome} — nunca revisada.`,
        entidade: 'Ferramenta', registroId: f.id, destino: 'ferramentas',
      });
    }
  }

  return alertas.sort((a, b) => NIVEL_ALERTA_ORDEM[b.nivel] - NIVEL_ALERTA_ORDEM[a.nivel]);
};
