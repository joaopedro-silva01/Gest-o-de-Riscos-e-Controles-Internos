/**
 * Módulo "Painel de Governança e Segurança da IA".
 *
 * Casca do módulo: menu lateral (seção 19), cabeçalho com perfil simulado,
 * central de notificações e roteamento interno. É montado pelo App.tsx do
 * painel gerencial existente (não é uma aplicação isolada).
 */
import React, { useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Bell, Bot, Building2, CheckSquare, ClipboardList, FileText, GraduationCap, Home,
  Menu, Search, Settings, ShieldCheck, Siren, Users, X, CheckCircle2, XCircle, Info as InfoIcon,
} from 'lucide-react';
import { cx } from './components/ui';
import { PERFIL_LABEL, PERFIS } from './domain/catalogs';
import type { PaginaId } from './domain/types';
import { podeAcessarPagina } from './services/permissions';
import { GovernanceProvider, useGovernanca } from './state/GovernanceContext';
import { AprovacoesPage } from './pages/AprovacoesPage';
import { EmConstrucaoPage, PlanoPagina } from './pages/EmConstrucaoPage';
import { GovernancaPage } from './pages/GovernancaPage';
import { RiscosAlertasPage } from './pages/RiscosAlertasPage';
import { VisaoGeralPage } from './pages/VisaoGeralPage';
import { podeDecidir } from './services/permissions';
import { aguardandoDecisao, podeAvancar, aguardandoHomologacao } from './services/workflow';

interface ItemMenu { id: PaginaId; rotulo: string; icone: React.ReactNode }

const MENU: ItemMenu[] = [
  { id: 'visao-geral', rotulo: 'Visão Geral', icone: <Home className="w-[18px] h-[18px]" /> },
  { id: 'governanca', rotulo: 'Governança da IA', icone: <ShieldCheck className="w-[18px] h-[18px]" /> },
  { id: 'colaboradores', rotulo: 'Colaboradores', icone: <Users className="w-[18px] h-[18px]" /> },
  { id: 'departamentos', rotulo: 'Departamentos', icone: <Building2 className="w-[18px] h-[18px]" /> },
  { id: 'ferramentas', rotulo: 'Ferramentas de IA', icone: <Bot className="w-[18px] h-[18px]" /> },
  { id: 'casos-uso', rotulo: 'Casos de Uso', icone: <ClipboardList className="w-[18px] h-[18px]" /> },
  { id: 'aprovacoes', rotulo: 'Aprovações', icone: <CheckSquare className="w-[18px] h-[18px]" /> },
  { id: 'riscos-alertas', rotulo: 'Riscos e Alertas', icone: <AlertTriangle className="w-[18px] h-[18px]" /> },
  { id: 'incidentes', rotulo: 'Incidentes', icone: <Siren className="w-[18px] h-[18px]" /> },
  { id: 'treinamentos', rotulo: 'Treinamentos', icone: <GraduationCap className="w-[18px] h-[18px]" /> },
  { id: 'politicas', rotulo: 'Políticas', icone: <FileText className="w-[18px] h-[18px]" /> },
  { id: 'auditoria', rotulo: 'Auditoria', icone: <Search className="w-[18px] h-[18px]" /> },
  { id: 'configuracoes', rotulo: 'Configurações', icone: <Settings className="w-[18px] h-[18px]" /> },
];

/** Escopo das telas das próximas etapas (exibido enquanto não são entregues). */
const PLANOS: Partial<Record<PaginaId, PlanoPagina>> = {
  colaboradores: { titulo: 'Uso de IA por Colaborador', selo: 'Orientar', etapa: 3, escopo: ['Pesquisa por nome, departamento, empresa, ferramenta, status e risco', 'Ficha: ferramentas, finalidades, processos, aprovações, treinamentos, pendências, incidentes e última revisão'], dadosDisponiveis: 'colaboradores, registros de uso, participações em treinamentos e incidentes.' },
  departamentos: { titulo: 'Mapa de Uso de IA por Departamento', selo: 'Controlar', etapa: 3, escopo: ['Usuários, ferramentas, casos de uso, risco, pendências, aprovações e incidentes por área', 'Detalhamento ao clicar no departamento'], dadosDisponiveis: 'departamentos, gestores e registros de uso.' },
  ferramentas: { titulo: 'Catálogo de Ferramentas', selo: 'Homologar', etapa: 2, escopo: ['Cards por ferramenta: status, homologação, risco, usuários, casos de uso, última revisão, responsável e restrições', 'Cadastro e edição pelo Administrador (Gemini, Claude, IAs públicas…)'], dadosDisponiveis: '6 ferramentas com categoria, permissões, restrições e política.' },
  'casos-uso': { titulo: 'Casos de Uso de IA', selo: 'Controlar', etapa: 2, escopo: ['Biblioteca com área, processo, ferramenta, objetivo, benefício, dados, risco, status, responsável, aprovação e controles', 'Cadastro e reutilização no assistente de solicitação'], dadosDisponiveis: '10 casos de uso do catálogo.' },
  incidentes: { titulo: 'Incidentes de IA', selo: 'Monitorar', etapa: 4, escopo: ['Registro e tratamento (Aberto → Em análise → Em tratamento → Resolvido → Encerrado)', 'Tipos: uso indevido, envio não autorizado, ferramenta não homologada, vazamento, resultado incorreto, falha de automação, violação de política'], dadosDisponiveis: '3 incidentes de demonstração (já alimentam indicadores e alertas).' },
  treinamentos: { titulo: 'Capacitação em IA', selo: 'Orientar', etapa: 4, escopo: ['Controle por colaborador: treinamento, data, status, certificação, reciclagem e próxima data', 'Indicadores: % treinados, % pendentes, % vencidos'], dadosDisponiveis: '5 treinamentos (2 obrigatórios) e participações.' },
  politicas: { titulo: 'Políticas de Uso de IA', selo: 'Orientar', etapa: 4, escopo: ['Regras: dados permitidos/proibidos, ferramentas, aprovação, responsabilidades, IA generativa, automações, dados de clientes', 'Versionamento (1.0, 1.1, 2.0…) com data, responsável e alterações'], dadosDisponiveis: '2 políticas com regras e histórico de versões.' },
  auditoria: { titulo: 'Trilha de Auditoria', selo: 'Rastreabilidade', etapa: 5, escopo: ['Quem alterou, o quê, valor anterior, novo valor, data e hora', 'Filtros por usuário, data, departamento, tipo de alteração e registro'], dadosDisponiveis: 'todos os eventos já são gravados (veja a aba Histórico de cada registro).' },
  configuracoes: { titulo: 'Configurações', selo: 'Administração', etapa: 5, escopo: ['Pesos e faixas da matriz de risco', 'Periodicidade de revisão, cadastros de apoio (empresas, departamentos, usuários, controles)', 'Restaurar dados de demonstração'], dadosDisponiveis: 'configurações padrão já aplicadas pelo motor de risco.' },
};

const Toasts: React.FC = () => {
  const { toasts } = useGovernanca();
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] space-y-2 sm:w-96" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={cx('flex items-start gap-2 rounded-lg shadow-lg px-4 py-3 text-sm border', t.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-900' : t.tipo === 'info' ? 'bg-gov-light border-blue-200 text-gov-navy' : 'bg-emerald-50 border-emerald-200 text-emerald-900')}>
          {t.tipo === 'erro' ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> : t.tipo === 'info' ? <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
          {t.texto}
        </div>
      ))}
    </div>
  );
};

const Shell: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const g = useGovernanca();
  const { nav, navegar, usuario, db, alertas, trocarUsuario, registros, ix } = g;
  const [menuAberto, setMenuAberto] = useState(false);

  const itens = MENU.filter(m => podeAcessarPagina(usuario, m.id));
  const pagina = podeAcessarPagina(usuario, nav.pagina) ? nav.pagina : itens[0].id;
  const alertasAtivos = alertas.filter(a => !a.reconhecido).length;
  const aguardandoMim = registros.filter(r => {
    const a = r.aprovacaoId ? ix.aprovacoes.get(r.aprovacaoId) : undefined;
    return a && (podeAvancar(a) || aguardandoDecisao(a) || aguardandoHomologacao(a)) && podeDecidir(db, usuario, r).ok;
  }).length;
  const contador: Partial<Record<PaginaId, number>> = { aprovacoes: aguardandoMim, 'riscos-alertas': alertasAtivos };

  const ir = (p: PaginaId) => { navegar(p); setMenuAberto(false); };
  const atual = MENU.find(m => m.id === pagina)!;

  const conteudo = () => {
    switch (pagina) {
      case 'visao-geral': return <VisaoGeralPage />;
      case 'governanca': return <GovernancaPage />;
      case 'aprovacoes': return <AprovacoesPage />;
      case 'riscos-alertas': return <RiscosAlertasPage />;
      default: return <EmConstrucaoPage plano={PLANOS[pagina]!} />;
    }
  };

  const sidebar = (
    <aside className="w-[260px] h-full bg-white border-r border-slate-200 flex flex-col shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
      <div className="p-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gov-navy flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-gov-gold" />
          </div>
          <div className="leading-tight">
            <p className="text-lg font-bold text-gov-navy tracking-tight">Cicllos</p>
            <p className="text-[9px] text-slate-500 font-bold tracking-[0.18em] uppercase">Grupo Pirâmide</p>
          </div>
        </div>
        <div className="mt-4 bg-gov-navy text-white py-2 px-3 rounded font-bold text-[11px] text-center uppercase tracking-wide border-b-2 border-gov-gold">
          Governança e Segurança da IA
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Menu do módulo">
        {itens.map(m => (
          <button
            key={m.id}
            onClick={() => ir(m.id)}
            aria-current={pagina === m.id ? 'page' : undefined}
            className={cx('w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-r-full border-l-4 transition-all', pagina === m.id ? 'border-gov-gold bg-gov-light text-gov-navy font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50')}
          >
            {m.icone}
            <span className="flex-1 text-left truncate">{m.rotulo}</span>
            {!!contador[m.id] && <span className="text-[10px] font-bold bg-gov-navy text-white rounded-full px-1.5 min-w-[20px] text-center">{contador[m.id]}</span>}
            {!PLANOS[m.id] ? null : <span className="text-[8px] font-bold text-slate-400 uppercase whitespace-nowrap" title="Tela prevista para as próximas etapas">em breve</span>}
          </button>
        ))}
      </nav>
      <div className="p-4 space-y-3 border-t border-slate-100">
        <label className="block">
          <span className="text-[10px] text-slate-500 font-bold uppercase">Simular perfil (demonstração)</span>
          <select value={usuario.id} onChange={e => trocarUsuario(e.target.value)} className="mt-1 w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2">
            {PERFIS.map(p => (
              <optgroup key={p} label={PERFIL_LABEL[p]}>
                {db.usuarios.filter(u => u.perfil === p).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {onExit && (
          <button onClick={onExit} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-gov-navy py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <ArrowLeft className="w-3.5 h-3.5" /> Painel de Gestão de Riscos
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-[#f3f4f6] font-sans text-slate-900 overflow-hidden">
      <div className="hidden lg:flex z-20">{sidebar}</div>
      {menuAberto && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="relative z-10">{sidebar}</div>
          <button className="flex-1 bg-gov-navy/40" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-4 sm:px-8 shadow-sm">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <button className="lg:hidden p-1.5 -ml-1 rounded hover:bg-slate-100" aria-label="Abrir menu" onClick={() => setMenuAberto(true)}>
              {menuAberto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="hidden sm:inline font-medium text-slate-400">Cicllos</span>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="hidden md:inline font-medium text-slate-400">Governança da IA</span>
            <span className="hidden md:inline text-slate-300">/</span>
            <span className="font-bold text-gov-navy truncate">{atual.rotulo}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => navegar('riscos-alertas')} className="relative text-slate-500 hover:text-gov-navy" aria-label={`${alertasAtivos} alertas ativos`} title={`${alertasAtivos} alertas ativos`}>
              <Bell className="w-5 h-5" />
              {alertasAtivos > 0 && <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[9px] font-bold rounded-full px-1 min-w-[16px] text-center border-2 border-white">{alertasAtivos}</span>}
            </button>
            <div className="w-px h-6 bg-slate-200" />
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-slate-800 truncate max-w-[140px] sm:max-w-none">{usuario.nome}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gov-golddeep">{PERFIL_LABEL[usuario.perfil]}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto">{conteudo()}</div>
        </main>
      </div>
      <Toasts />
    </div>
  );
};

const AIGovernanceModule: React.FC<{ onExit?: () => void }> = ({ onExit }) => (
  <GovernanceProvider>
    <Shell onExit={onExit} />
  </GovernanceProvider>
);

export default AIGovernanceModule;
