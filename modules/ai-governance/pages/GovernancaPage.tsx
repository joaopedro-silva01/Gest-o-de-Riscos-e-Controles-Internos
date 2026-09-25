/**
 * 🛡 Governança da IA — Registro de Uso de IA (inventário corporativo).
 * Responde: QUEM usa, QUAL IA, PARA QUE, QUAIS DADOS, QUAL RISCO, FOI APROVADO,
 * QUAIS CONTROLES, QUEM É RESPONSÁVEL, QUANDO FOI REVISADO.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Download, Search } from 'lucide-react';
import { FiltrosGlobaisBar } from '../components/FiltrosGlobaisBar';
import { NovoRegistroWizard } from '../components/NovoRegistroWizard';
import { RegistroDetalhe } from '../components/RegistroDetalhe';
import { LegendaDados, RegistrosTabela } from '../components/RegistrosTabela';
import { Botao, Card, PageHeader, cx, inputCls } from '../components/ui';
import { ETAPA_LABEL, NIVEL_RISCO_LABEL, STATUS_PENDENTES, TIPOS_DADO, TIPO_DADO_LABEL } from '../domain/catalogs';
import type { RegistroUso } from '../domain/types';
import { departamentoDoRegistro, empresaDoRegistro, nome } from '../services/derived';
import { exportarCsv } from '../services/export';
import { nivelEfetivo } from '../services/riskEngine';
import { etapaAtual } from '../services/workflow';
import { useGovernanca } from '../state/GovernanceContext';

type Aba = 'todos' | 'pendentes' | 'autorizados' | 'restritos' | 'encerrados';

export const GovernancaPage: React.FC = () => {
  const { registrosFiltrados, ix, nav, navegar, pode, usuario, hoje } = useGovernanca();
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<Aba>('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  // Abre o detalhe quando a navegação vem de um alerta ou de outra página.
  useEffect(() => {
    if (nav.pagina === 'governanca' && nav.registroId) setAberto(nav.registroId);
  }, [nav]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return registrosFiltrados
      .filter(r => {
        if (aba === 'pendentes') return STATUS_PENDENTES.includes(r.status);
        if (aba === 'autorizados') return ['Aprovado', 'Em monitoramento'].includes(r.status);
        if (aba === 'restritos') return ['Aprovado com restrições', 'Suspenso'].includes(r.status);
        if (aba === 'encerrados') return ['Encerrado', 'Não aprovado'].includes(r.status);
        return true;
      })
      .filter(r => !q || [r.codigo, r.atividade, r.processo, r.finalidade, ix.usuarios.get(r.colaboradorId)?.nome, ix.ferramentas.get(r.ferramentaId)?.nome].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [registrosFiltrados, aba, busca, ix]);

  const contagem = (a: Aba) => registrosFiltrados.filter(r =>
    a === 'todos' ? true : a === 'pendentes' ? STATUS_PENDENTES.includes(r.status) : a === 'autorizados' ? ['Aprovado', 'Em monitoramento'].includes(r.status) : a === 'restritos' ? ['Aprovado com restrições', 'Suspenso'].includes(r.status) : ['Encerrado', 'Não aprovado'].includes(r.status),
  ).length;

  const exportar = () =>
    exportarCsv<RegistroUso>(lista, [
      { titulo: 'ID', valor: r => r.codigo },
      { titulo: 'Colaborador', valor: r => nome(ix, r.colaboradorId) },
      { titulo: 'Departamento', valor: r => ix.departamentos.get(departamentoDoRegistro(ix, r) ?? '')?.nome },
      { titulo: 'Empresa', valor: r => ix.empresas.get(empresaDoRegistro(ix, r) ?? '')?.nome },
      { titulo: 'Cargo', valor: r => ix.usuarios.get(r.colaboradorId)?.cargo },
      { titulo: 'Ferramenta', valor: r => ix.ferramentas.get(r.ferramentaId)?.nome },
      { titulo: 'Processo', valor: r => r.processo },
      { titulo: 'Atividade', valor: r => r.atividade },
      { titulo: 'Finalidade', valor: r => r.finalidade },
      { titulo: 'Frequência', valor: r => r.frequencia },
      { titulo: 'Data de início', valor: r => r.dataInicio },
      { titulo: 'Responsável pelo processo', valor: r => nome(ix, r.responsavelProcessoId) },
      ...TIPOS_DADO.map(t => ({ titulo: TIPO_DADO_LABEL[t], valor: (r: RegistroUso) => r.dados[t] })),
      { titulo: 'Necessita aprovação', valor: r => r.risco.necessitaAprovacao },
      { titulo: 'Etapa atual', valor: r => { const a = r.aprovacaoId ? ix.aprovacoes.get(r.aprovacaoId) : undefined; const e = a && etapaAtual(a); return e ? ETAPA_LABEL[e.etapa] : ''; } },
      { titulo: 'Responsável pela aprovação', valor: r => { const a = r.aprovacaoId ? ix.aprovacoes.get(r.aprovacaoId) : undefined; return a?.aprovadorId ? nome(ix, a.aprovadorId) : a?.automatica ? 'Automática' : ''; } },
      { titulo: 'Pontuação de risco', valor: r => r.risco.pontuacao },
      { titulo: 'Nível de risco', valor: r => NIVEL_RISCO_LABEL[nivelEfetivo(r)] },
      { titulo: 'Fatores de risco', valor: r => r.risco.fatores.filter(f => f.pontos > 0).map(f => `${f.fator} (+${f.pontos})`).join(', ') },
      { titulo: 'Controles', valor: r => r.controleIds.map(id => ix.controles.get(id)?.nome).join(', ') },
      { titulo: 'Última revisão', valor: r => r.ultimaRevisao },
      { titulo: 'Próxima revisão', valor: r => r.proximaRevisao },
      { titulo: 'Status', valor: r => r.status },
    ], `registro-uso-ia-${hoje}.csv`);

  const abas: [Aba, string][] = [['todos', 'Todos'], ['pendentes', 'Pendentes'], ['autorizados', 'Autorizados'], ['restritos', 'Com restrição / suspensos'], ['encerrados', 'Encerrados / não aprovados']];

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        selo="Governança da IA"
        titulo="Registro de Uso de IA"
        subtitulo={usuario.perfil === 'COLABORADOR' ? 'Suas utilizações de IA e o andamento das solicitações.' : 'Inventário das utilizações de IA, com risco, aprovação, controles e revisão.'}
        acoes={
          <>
            {pode('relatorio.exportar') && <Botao variante="secundario" icone={<Download className="w-4 h-4" />} onClick={exportar}>Exportar CSV</Botao>}
            {pode('uso.registrar') && <Botao variante="dourado" icone={<Plus className="w-4 h-4" />} onClick={() => setNovo(true)}>Solicitar nova utilização de IA</Botao>}
          </>
        }
      />
      <FiltrosGlobaisBar />
      <Card corpo="p-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 pt-3">
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {abas.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cx('px-3 py-2 text-sm font-semibold border-b-2 whitespace-nowrap', aba === k ? 'border-gov-gold text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                {l} <span className="text-xs text-slate-400">({contagem(k)})</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-72 pb-2 lg:pb-0">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Buscar código, atividade, pessoa…" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="border-t border-slate-200 mt-2">
          <RegistrosTabela registros={lista} onAbrir={setAberto} />
        </div>
        <div className="px-4 py-2 border-t border-slate-100"><LegendaDados /></div>
      </Card>

      {novo && <NovoRegistroWizard onFechar={() => setNovo(false)} onCriado={id => { setNovo(false); setAberto(id); }} />}
      {aberto && <RegistroDetalhe registroId={aberto} onFechar={() => { setAberto(null); if (nav.registroId) navegar('governanca'); }} />}
    </div>
  );
};
