/**
 * ✅ Aprovações — fila de trabalho do fluxo de homologação.
 * Mostra primeiro o que depende do usuário atual; o restante fica visível para acompanhamento.
 */
import React, { useMemo, useState } from 'react';
import { RegistroDetalhe } from '../components/RegistroDetalhe';
import { RegistrosTabela } from '../components/RegistrosTabela';
import { Card, KpiCard, PageHeader } from '../components/ui';
import { ETAPAS_FLUXO, ETAPA_LABEL, NIVEL_RISCO_ORDEM } from '../domain/catalogs';
import { podeDecidir } from '../services/permissions';
import { nivelEfetivo } from '../services/riskEngine';
import { etapaAtual } from '../services/workflow';
import { useGovernanca } from '../state/GovernanceContext';
import { diasEntre } from '../utils/dates';

export const AprovacoesPage: React.FC = () => {
  const { db, ix, usuario, registrosFiltrados } = useGovernanca();
  const [aberto, setAberto] = useState<string | null>(null);

  const { minhas, outras, porEtapa, tempoMedio } = useMemo(() => {
    // "Em andamento" = fluxo ainda antes do monitoramento (análise, decisão ou homologação).
    const emFluxo = registrosFiltrados.filter(r => {
      const a = r.aprovacaoId ? ix.aprovacoes.get(r.aprovacaoId) : undefined;
      const e = a && etapaAtual(a);
      return a && e && ['ANALISE', 'CLASSIFICACAO_RISCO', 'AVALIACAO_DADOS', 'APROVACAO', 'HOMOLOGACAO'].includes(e.etapa) && !a.etapas.some(x => x.status === 'Reprovada');
    });
    // Prioridade: risco mais alto primeiro, depois mais antigo.
    emFluxo.sort((a, b) => NIVEL_RISCO_ORDEM[nivelEfetivo(b)] - NIVEL_RISCO_ORDEM[nivelEfetivo(a)] || a.criadoEm.localeCompare(b.criadoEm));
    const minhas = emFluxo.filter(r => podeDecidir(db, usuario, r).ok);
    const outras = emFluxo.filter(r => !minhas.includes(r));
    const porEtapa = ETAPAS_FLUXO.slice(1, 6).map(et => ({
      etapa: et,
      qtd: emFluxo.filter(r => etapaAtual(ix.aprovacoes.get(r.aprovacaoId!)!)?.etapa === et).length,
    }));
    const decididas = db.aprovacoes.filter(a => a.dataDecisao && !a.automatica);
    const tempoMedio = decididas.length ? Math.round(decididas.reduce((s, a) => s + diasEntre(a.dataSolicitacao.slice(0, 10), a.dataDecisao!.slice(0, 10)), 0) / decididas.length) : 0;
    return { minhas, outras, porEtapa, tempoMedio };
  }, [registrosFiltrados, ix, db, usuario]);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Fluxo de homologação" titulo="Aprovações" subtitulo="Solicitação → Análise → Classificação de risco → Avaliação de dados → Aprovação → Homologação → Monitoramento → Revisão" />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {porEtapa.map(p => <KpiCard key={p.etapa} rotulo={ETAPA_LABEL[p.etapa]} valor={p.qtd} tom={p.qtd ? 'amarelo' : 'neutro'} />)}
        <KpiCard rotulo="Tempo médio até decisão" valor={`${tempoMedio}d`} detalhe="Aprovações não automáticas" tom="navy" />
      </div>

      <Card titulo={`Aguardando sua ação (${minhas.length})`} subtitulo="Ordenado por risco e antiguidade. Alto/Crítico exige Administrador (Comitê); ninguém aprova a própria solicitação." corpo="p-0 pt-3">
        <RegistrosTabela registros={minhas} onAbrir={setAberto} vazio="Nada aguardando sua ação." />
      </Card>
      <Card titulo={`Em andamento com outros avaliadores (${outras.length})`} corpo="p-0 pt-3">
        <RegistrosTabela registros={outras} onAbrir={setAberto} vazio="Nenhum outro fluxo em andamento." />
      </Card>
      <p className="text-xs text-slate-500">Aprovações automáticas por política não entram nesta fila, mas ficam registradas no fluxo de cada utilização.</p>

      {aberto && <RegistroDetalhe registroId={aberto} onFechar={() => setAberto(null)} />}
    </div>
  );
};
