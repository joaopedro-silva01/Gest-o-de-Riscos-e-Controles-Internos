/**
 * DADOS FICTÍCIOS — apenas para demonstração (seção 28).
 * Nenhum nome, e-mail ou registro abaixo corresponde a pessoas reais.
 * As datas são relativas ao dia de hoje para que alertas e prazos façam sentido
 * sempre que a demonstração for restaurada.
 */
import type {
  Aprovacao,
  CasoUso,
  ClassificacaoDados,
  Configuracoes,
  ContextoRisco,
  Controle,
  Departamento,
  Empresa,
  EventoAuditoria,
  FerramentaIA,
  GovernanceDB,
  ID,
  Incidente,
  Melhoria,
  Participacao,
  Politica,
  RegistroUso,
  RiscoIA,
  StatusUso,
  Treinamento,
  Usuario,
} from '../domain/types';
import { calcularRisco, nivelMatriz, PESOS_PADRAO } from '../services/riskEngine';
import { avancarEtapa, criarFluxo, decidir, homologar, proximaRevisaoRegistro } from '../services/workflow';
import { addDias, addMeses, hoje as hojeFn } from '../utils/dates';

export const SCHEMA_VERSION = 1;

export const CONFIGURACOES_PADRAO: Configuracoes = {
  pesosRisco: PESOS_PADRAO,
  periodicidadeRevisaoMeses: { BAIXO: 12, MEDIO: 6, ALTO: 3, CRITICO: 1 },
  diasRevisaoFerramenta: 180,
  diasAvisoPolitica: 30,
};

export const criarSeed = (): GovernanceDB => {
  const hoje = hojeFn();
  const d = (dias: number) => addDias(hoje, dias);
  const dt = (dias: number) => `${d(dias)}T10:00:00.000Z`;

  // ---------------------------------------------------------------- Empresas
  const empresas: Empresa[] = [
    { id: 'emp-seg', nome: 'Cicllos Seguradora', sigla: 'SEG' },
    { id: 'emp-pay', nome: 'Ciclos Pay', sigla: 'PAY' },
    { id: 'emp-hold', nome: 'Pirâmide Holding', sigla: 'HLD' },
  ];

  // ----------------------------------------------------------- Departamentos
  const departamentos: Departamento[] = [
    { id: 'dep-mkt', nome: 'Marketing', gestorId: 'usr-02' },
    { id: 'dep-com', nome: 'Comercial', gestorId: 'usr-05' },
    { id: 'dep-sin', nome: 'Sinistros', gestorId: 'usr-07' },
    { id: 'dep-fin', nome: 'Financeiro', gestorId: 'usr-09' },
    { id: 'dep-jur', nome: 'Jurídico', gestorId: undefined },
    { id: 'dep-ti', nome: 'Tecnologia e Segurança', gestorId: 'usr-01' },
    { id: 'dep-dir', nome: 'Diretoria', gestorId: 'usr-12' },
  ];

  // ---------------------------------------------------------------- Usuários
  const u = (id: string, nome: string, cargo: string, empresaId: ID, departamentoId: ID, perfil: Usuario['perfil'], cad: number): Usuario => ({
    id, nome, cargo, empresaId, departamentoId, perfil, ativo: true,
    email: `${nome.split(' ')[0].toLowerCase()}.${nome.split(' ').slice(-1)[0].toLowerCase()}@exemplo.com.br`,
    dataCadastro: d(cad),
  });
  const usuarios: Usuario[] = [
    u('usr-01', 'Helena Duarte', 'Coordenadora de Governança e Segurança', 'emp-hold', 'dep-ti', 'ADMINISTRADOR', -400),
    u('usr-02', 'Rafael Monteiro', 'Gerente de Marketing', 'emp-seg', 'dep-mkt', 'GESTOR', -380),
    u('usr-03', 'Camila Rezende', 'Analista de Conteúdo', 'emp-seg', 'dep-mkt', 'COLABORADOR', -300),
    u('usr-04', 'Tiago Farias', 'Designer', 'emp-pay', 'dep-mkt', 'COLABORADOR', -250),
    u('usr-05', 'Beatriz Lacerda', 'Gerente Comercial', 'emp-seg', 'dep-com', 'GESTOR', -390),
    u('usr-06', 'Lucas Tavares', 'Executivo de Contas', 'emp-seg', 'dep-com', 'COLABORADOR', -200),
    u('usr-07', 'Paula Cardoso', 'Coordenadora de Sinistros', 'emp-seg', 'dep-sin', 'GESTOR', -360),
    u('usr-08', 'Diego Sampaio', 'Analista de Sinistros', 'emp-seg', 'dep-sin', 'COLABORADOR', -180),
    u('usr-09', 'Fernanda Rocha', 'Controller', 'emp-pay', 'dep-fin', 'GESTOR', -350),
    u('usr-10', 'Gustavo Pires', 'Analista Financeiro', 'emp-pay', 'dep-fin', 'COLABORADOR', -150),
    u('usr-11', 'Larissa Moura', 'Advogada', 'emp-hold', 'dep-jur', 'COLABORADOR', -120),
    u('usr-12', 'Roberto Almeida', 'Diretor Executivo', 'emp-hold', 'dep-dir', 'DIRETORIA', -420),
    u('usr-13', 'Sônia Barreto', 'Auditora Interna', 'emp-hold', 'dep-dir', 'AUDITOR', -410),
    u('usr-14', 'Marcos Vieira', 'Desenvolvedor', 'emp-pay', 'dep-ti', 'COLABORADOR', -240),
  ];

  // ---------------------------------------------------------------- Políticas
  const politicas: Politica[] = [
    {
      id: 'pol-01',
      titulo: 'Política de Uso Responsável de Inteligência Artificial',
      descricao: 'Diretrizes corporativas para uso seguro, ético e rastreável de ferramentas de IA.',
      versaoAtual: '1.1',
      status: 'Vigente',
      vigenciaAte: d(300),
      responsavelId: 'usr-01',
      regras: [
        { id: 'rg-01', tipo: 'Ferramentas autorizadas', descricao: 'Google Gemini (Workspace corporativo) é a ferramenta prioritária e homologada.' },
        { id: 'rg-02', tipo: 'Necessidade de aprovação', descricao: 'Claude e ferramentas de fornecedores exigem solicitação, justificativa e avaliação prévia.' },
        { id: 'rg-03', tipo: 'Ferramentas restritas', descricao: 'IAs públicas não homologadas: uso restrito, sem dados corporativos protegidos.' },
        { id: 'rg-04', tipo: 'Dados proibidos', descricao: 'Não inserir dados sensíveis, dados de clientes, contratos, apólices, sinistros ou informações corporativas protegidas sem autorização.' },
        { id: 'rg-05', tipo: 'Dados permitidos', descricao: 'Informações públicas, textos institucionais já divulgados e dados anonimizados.' },
        { id: 'rg-06', tipo: 'IA generativa', descricao: 'Todo conteúdo gerado deve ser revisado por uma pessoa antes de uso externo.' },
        { id: 'rg-07', tipo: 'Automações', descricao: 'Automações com IA precisam de responsável, registro e revisão humana em decisões que afetem clientes.' },
        { id: 'rg-08', tipo: 'Dados de clientes', descricao: 'Dados de clientes somente em ferramenta homologada, com base legal e controles aprovados.' },
        { id: 'rg-09', tipo: 'Responsabilidades', descricao: 'O colaborador responde pelo conteúdo inserido; o gestor pela aprovação; Governança pela homologação.' },
      ],
      versoes: [
        { versao: '1.0', data: d(-240), responsavelId: 'usr-01', alteracoes: 'Versão inicial aprovada pela Diretoria.' },
        { versao: '1.1', data: d(-60), responsavelId: 'usr-01', alteracoes: 'Inclusão de regras para automações e dados de clientes.' },
      ],
    },
    {
      id: 'pol-02',
      titulo: 'Norma de Classificação de Dados para uso em IA',
      descricao: 'Define os níveis de sensibilidade da informação e o que pode ser inserido em cada categoria de ferramenta.',
      versaoAtual: '1.0',
      status: 'Vigente',
      vigenciaAte: d(20),
      responsavelId: 'usr-01',
      regras: [
        { id: 'rg-10', tipo: 'Dados permitidos', descricao: 'Público e Interno: permitido em ferramentas homologadas.' },
        { id: 'rg-11', tipo: 'Dados proibidos', descricao: 'Confidencial e Restrito: apenas com aprovação e anonimização.' },
      ],
      versoes: [{ versao: '1.0', data: d(-345), responsavelId: 'usr-01', alteracoes: 'Versão inicial.' }],
    },
  ];

  // --------------------------------------------------------------- Ferramentas
  const ferramentas: FerramentaIA[] = [
    {
      id: 'fer-gemini', nome: 'Google Gemini', fornecedor: 'Google', categoria: 'HOMOLOGADA', tipo: 'Corporativa integrada',
      url: 'https://gemini.google.com', status: 'Ativa', usoRecomendado: 'Prioritário',
      descricao: 'IA homologada e integrada ao ambiente corporativo Google Workspace/Drive.',
      exposicaoExterna: false, dataHomologacao: d(-230), responsavelHomologacaoId: 'usr-01', nivelRisco: 'BAIXO',
      permissoes: ['Textos e comunicação interna', 'Resumo de documentos do Drive corporativo', 'Análise de planilhas internas'],
      restricoes: ['Dados sensíveis somente com aprovação', 'Uso exclusivo com conta corporativa'],
      observacoes: 'Acesso via SSO corporativo; dados não utilizados para treinamento do modelo.', politicaId: 'pol-01', ultimaRevisao: d(-40),
    },
    {
      id: 'fer-claude', nome: 'Claude', fornecedor: 'Anthropic', categoria: 'USO_MEDIANTE_APROVACAO', tipo: 'Pública (SaaS)',
      url: 'https://claude.ai', status: 'Ativa', usoRecomendado: 'Controlado',
      descricao: 'Apoio a automações, estruturação e desenvolvimento de processos, mediante solicitação, justificativa e avaliação.',
      exposicaoExterna: true, dataHomologacao: d(-120), responsavelHomologacaoId: 'usr-01', nivelRisco: 'MEDIO',
      permissoes: ['Desenvolvimento e revisão de código', 'Estruturação de processos', 'Documentação técnica'],
      restricoes: ['Proibido dado de cliente sem anonimização', 'Requer aprovação prévia por caso de uso'],
      observacoes: 'Uso liberado por caso de uso aprovado.', politicaId: 'pol-01', ultimaRevisao: d(-95),
    },
    {
      id: 'fer-chatgpt', nome: 'ChatGPT', fornecedor: 'OpenAI', categoria: 'NAO_HOMOLOGADA', tipo: 'Pública (SaaS)',
      url: 'https://chatgpt.com', status: 'Em avaliação', usoRecomendado: 'Restrito',
      descricao: 'Não inserir dados sensíveis, informações de clientes, contratos, apólices, sinistros ou demais informações corporativas protegidas sem autorização.',
      exposicaoExterna: true, nivelRisco: 'ALTO', permissoes: ['Pesquisa de conteúdo público'],
      restricoes: ['Sem dados corporativos protegidos', 'Sem dados de clientes'], observacoes: 'Avaliação de contrato corporativo em andamento.', politicaId: 'pol-01', ultimaRevisao: d(-200),
    },
    {
      id: 'fer-copilot', nome: 'Microsoft Copilot', fornecedor: 'Microsoft', categoria: 'NAO_HOMOLOGADA', tipo: 'Pública (SaaS)',
      url: 'https://copilot.microsoft.com', status: 'Em avaliação', usoRecomendado: 'Restrito',
      descricao: 'Em avaliação. Uso restrito a conteúdo público até conclusão da homologação.',
      exposicaoExterna: true, nivelRisco: 'ALTO', permissoes: ['Pesquisa de conteúdo público'], restricoes: ['Sem dados corporativos'],
      observacoes: '', politicaId: 'pol-01',
    },
    {
      id: 'fer-perplexity', nome: 'Perplexity', fornecedor: 'Perplexity AI', categoria: 'NAO_HOMOLOGADA', tipo: 'Pública (SaaS)',
      url: 'https://www.perplexity.ai', status: 'Ativa', usoRecomendado: 'Restrito',
      descricao: 'IA pública de pesquisa. Uso restrito: não inserir informações corporativas.',
      exposicaoExterna: true, nivelRisco: 'ALTO', permissoes: ['Pesquisa de mercado com fontes públicas'], restricoes: ['Sem dados corporativos'],
      observacoes: '', politicaId: 'pol-01', ultimaRevisao: d(-150),
    },
    {
      id: 'fer-sinistro', nome: 'Motor de triagem de sinistros (fornecedor)', fornecedor: 'Fornecedor de sistema de sinistros', categoria: 'USO_MEDIANTE_APROVACAO', tipo: 'Embarcada em fornecedor',
      url: '', status: 'Ativa', usoRecomendado: 'Controlado',
      descricao: 'Módulo de IA embarcado no sistema de sinistros para triagem e priorização de avisos.',
      exposicaoExterna: true, dataHomologacao: d(-90), responsavelHomologacaoId: 'usr-01', nivelRisco: 'ALTO',
      permissoes: ['Triagem de avisos de sinistro'], restricoes: ['Decisão final sempre humana', 'Contrato com cláusula LGPD'],
      observacoes: 'DPA assinado com fornecedor.', politicaId: 'pol-01', ultimaRevisao: d(-90),
    },
  ];

  // ----------------------------------------------------------------- Controles
  const controles: Controle[] = [
    { id: 'ctl-01', nome: 'Acesso via conta corporativa (SSO)', descricao: 'Uso apenas com conta Google Workspace corporativa.', tipo: 'Preventivo', responsavelId: 'usr-01', efetividade: 'Efetivo' },
    { id: 'ctl-02', nome: 'Anonimização prévia de dados', descricao: 'Remoção de identificadores antes do envio à IA.', tipo: 'Preventivo', responsavelId: 'usr-01', efetividade: 'Parcial' },
    { id: 'ctl-03', nome: 'Revisão humana obrigatória', descricao: 'Resultado revisado por pessoa antes de uso externo ou decisão.', tipo: 'Detectivo', efetividade: 'Efetivo' },
    { id: 'ctl-04', nome: 'Proibição de dados de clientes em IA pública', descricao: 'Regra de política + orientação + DLP.', tipo: 'Preventivo', responsavelId: 'usr-01', efetividade: 'Parcial' },
    { id: 'ctl-05', nome: 'DLP no Google Workspace', descricao: 'Regras de prevenção de perda de dados no Drive e Gmail.', tipo: 'Detectivo', responsavelId: 'usr-01', efetividade: 'Não avaliado' },
    { id: 'ctl-06', nome: 'Aprovação prévia do gestor', descricao: 'Uso condicionado à aprovação no fluxo de homologação.', tipo: 'Preventivo', efetividade: 'Efetivo' },
    { id: 'ctl-07', nome: 'Cláusula contratual LGPD com fornecedor', descricao: 'DPA e cláusulas de confidencialidade.', tipo: 'Preventivo', responsavelId: 'usr-11', efetividade: 'Efetivo' },
  ];

  // ------------------------------------------------------------ Casos de uso
  const cu = (id: string, nome: string, departamentoId: ID, processo: string, ferramentaIds: ID[], objetivo: string, beneficioEsperado: string, dadosUtilizados: CasoUso['dadosUtilizados'], nivelRisco: CasoUso['nivelRisco'], responsavelId: ID | undefined, aprovado: boolean, controleIds: ID[], status: CasoUso['status'] = 'Ativo'): CasoUso =>
    ({ id, nome, departamentoId, processo, ferramentaIds, objetivo, beneficioEsperado, dadosUtilizados, nivelRisco, responsavelId, aprovado, controleIds, status, ultimaRevisao: d(-60) });
  const casosUso: CasoUso[] = [
    cu('cu-01', 'Criação de textos de marketing', 'dep-mkt', 'Comunicação e campanhas', ['fer-gemini'], 'Gerar rascunhos de textos para campanhas e redes sociais.', 'Redução de 40% no tempo de produção de conteúdo.', [], 'BAIXO', 'usr-02', true, ['ctl-01', 'ctl-03']),
    cu('cu-02', 'Análise de indicadores', 'dep-fin', 'Fechamento mensal', ['fer-gemini'], 'Apoiar a leitura e comentário de indicadores financeiros.', 'Relatórios gerenciais mais rápidos.', ['financeiro'], 'MEDIO', 'usr-09', true, ['ctl-01', 'ctl-03']),
    cu('cu-03', 'Automação de processos', 'dep-ti', 'Automação interna', ['fer-claude'], 'Estruturar e desenvolver automações de processos internos.', 'Eliminação de tarefas manuais repetitivas.', [], 'MEDIO', 'usr-01', true, ['ctl-03', 'ctl-06']),
    cu('cu-04', 'Análise documental', 'dep-sin', 'Regulação de sinistros', ['fer-sinistro'], 'Triagem de documentos recebidos em avisos de sinistro.', 'Priorização de casos e redução do tempo de resposta.', ['pessoal', 'cliente'], 'ALTO', 'usr-07', true, ['ctl-03', 'ctl-07']),
    cu('cu-05', 'Atendimento ao cliente', 'dep-com', 'Relacionamento', ['fer-gemini'], 'Sugestão de respostas para e-mails de clientes.', 'Padronização e agilidade no atendimento.', ['pessoal', 'cliente'], 'ALTO', 'usr-05', false, ['ctl-01', 'ctl-02', 'ctl-03'], 'Em avaliação'),
    cu('cu-06', 'Programação', 'dep-ti', 'Desenvolvimento de sistemas', ['fer-claude', 'fer-gemini'], 'Apoio a desenvolvimento, revisão e documentação de código.', 'Produtividade da equipe de desenvolvimento.', [], 'MEDIO', 'usr-01', true, ['ctl-03', 'ctl-06']),
    cu('cu-07', 'Elaboração de relatórios', 'dep-dir', 'Governança corporativa', ['fer-gemini'], 'Consolidação de relatórios executivos.', 'Relatórios mais objetivos para a Diretoria.', ['estrategico'], 'MEDIO', 'usr-12', true, ['ctl-01']),
    cu('cu-08', 'Análise de contratos', 'dep-jur', 'Gestão contratual', ['fer-gemini'], 'Resumo e comparação de cláusulas contratuais.', 'Agilidade na revisão contratual.', ['contratual', 'estrategico'], 'ALTO', undefined, false, ['ctl-01', 'ctl-03'], 'Em avaliação'),
    cu('cu-09', 'Suporte à Diretoria', 'dep-dir', 'Planejamento estratégico', ['fer-gemini'], 'Apoio na preparação de pautas e materiais de reunião.', 'Economia de tempo da Diretoria.', ['estrategico'], 'MEDIO', 'usr-12', true, ['ctl-01', 'ctl-03']),
    cu('cu-10', 'Pesquisa de mercado', 'dep-com', 'Inteligência comercial', ['fer-perplexity'], 'Pesquisa de tendências de mercado com fontes públicas.', 'Insumos para estratégia comercial.', [], 'MEDIO', 'usr-05', false, ['ctl-04']),
  ];

  // --------------------------------------------------------- Registros de uso
  const registrosUso: RegistroUso[] = [];
  const aprovacoes: Aprovacao[] = [];
  const auditoria: EventoAuditoria[] = [];
  const periodicidade = CONFIGURACOES_PADRAO.periodicidadeRevisaoMeses;
  const semDados: ClassificacaoDados = { pessoal: false, sensivel: false, cliente: false, financeiro: false, contratual: false, estrategico: false };
  const ctxBase: ContextoRisco = { impactoProcesso: 'BAIXO', grauAutomacao: 'ASSISTIDO', decisaoHumana: 'SEMPRE' };
  let seq = 0;

  interface Reg {
    colab: ID; ferr: ID; caso?: ID; processo: string; atividade: string; finalidade: string; freq: RegistroUso['frequencia'];
    inicio: number; resp: ID | ''; dados?: Partial<ClassificacaoDados>; descDados: string; ctx?: Partial<ContextoRisco>;
    controles: ID[];
    /** Estado final desejado do fluxo na demonstração. */
    fim: 'auto' | 'analise' | 'aguardando_decisao' | 'homologacao' | 'aprovado' | 'restricao' | 'reprovado' | 'suspenso' | 'encerrado';
    aprovador?: ID; revisaoAtrasada?: boolean; sensivel?: RegistroUso['detalheSensivel'];
  }

  const criarReg = (x: Reg) => {
    seq++;
    const id = `uso-${String(seq).padStart(3, '0')}`;
    const ferramenta = ferramentas.find(f => f.id === x.ferr)!;
    const dados = { ...semDados, ...x.dados };
    const contexto = { ...ctxBase, ...x.ctx };
    const criadoEm = dt(x.inicio);
    const base: RegistroUso = {
      id, codigo: `IA-${String(seq).padStart(4, '0')}`, colaboradorId: x.colab, ferramentaId: x.ferr, casoUsoId: x.caso,
      processo: x.processo, atividade: x.atividade, finalidade: x.finalidade, frequencia: x.freq, dataInicio: d(x.inicio),
      responsavelProcessoId: x.resp, dados, descricaoDados: x.descDados, detalheSensivel: x.sensivel, contexto,
      risco: calcularRisco({ ferramenta, dados, contexto }, PESOS_PADRAO), controleIds: x.controles, observacoes: '',
      status: 'Em análise', criadoEm, criadoPorId: x.colab,
    };
    const fluxo = criarFluxo(base, `apr-${String(seq).padStart(3, '0')}`, x.colab, criadoEm);
    let aprov = fluxo.aprovacao;
    let status: StatusUso = fluxo.status;
    const aprovador = x.aprovador ?? 'usr-01';
    const passo = (dias: number) => dt(x.inicio + dias);

    if (x.fim !== 'auto' && x.fim !== 'analise') {
      aprov = avancarEtapa(aprov, aprovador, passo(1), 'Escopo e finalidade analisados.');
      aprov = avancarEtapa(aprov, aprovador, passo(1), 'Classificação de risco revisada.');
      aprov = avancarEtapa(aprov, aprovador, passo(2), 'Dados avaliados; controles definidos.');
      if (x.fim !== 'aguardando_decisao') {
        const decisao = x.fim === 'reprovado' ? 'Não aprovado' : x.fim === 'restricao' ? 'Aprovado com restrições' : 'Aprovado';
        const just = decisao === 'Não aprovado' ? 'Uso envolve dados de clientes em ferramenta não homologada.' : decisao === 'Aprovado com restrições' ? 'Aprovado somente com dados anonimizados.' : 'Uso aderente à política.';
        const r = decidir(aprov, decisao, aprovador, passo(3), just);
        aprov = r.aprovacao;
        status = r.status;
        if (x.fim !== 'reprovado' && x.fim !== 'homologacao') aprov = homologar(aprov, aprovador, passo(4), 'Controles configurados e uso liberado.');
      }
    }
    if (x.fim === 'suspenso') status = 'Suspenso';
    if (x.fim === 'encerrado') status = 'Encerrado';
    if (x.fim === 'restricao' && x.inicio < -120) status = 'Em monitoramento';

    const autorizado = ['Aprovado', 'Aprovado com restrições', 'Em monitoramento', 'Suspenso'].includes(status);
    const reg: RegistroUso = { ...base, status, aprovacaoId: aprov.id };
    if (autorizado) {
      const ultima = x.revisaoAtrasada ? addMeses(hoje, -periodicidade[reg.risco.nivelSugerido] - 1) : d(Math.max(x.inicio + 4, -20));
      reg.ultimaRevisao = ultima;
      reg.proximaRevisao = proximaRevisaoRegistro(reg, ultima, periodicidade);
    }
    registrosUso.push(reg);
    aprovacoes.push(aprov);
    const colab = usuarios.find(y => y.id === x.colab)!;
    auditoria.push({
      id: `aud-seed-${seq}`, dataHora: criadoEm, usuarioId: x.colab, entidade: 'Registro de uso', registroId: id,
      registroRotulo: `${reg.codigo} — ${reg.atividade}`, acao: 'SUBMISSÃO', alteracoes: [{ campo: 'status', anterior: undefined, novo: fluxo.status }],
      departamentoId: colab.departamentoId,
    });
    if (aprov.decisao && !aprov.automatica) {
      auditoria.push({
        id: `aud-seed-${seq}-d`, dataHora: aprov.dataDecisao!, usuarioId: aprovador, entidade: 'Aprovação', registroId: aprov.id,
        registroRotulo: `${reg.codigo} — ${reg.atividade}`, acao: aprov.decisao === 'Não aprovado' ? 'REPROVAÇÃO' : 'APROVAÇÃO',
        alteracoes: [{ campo: 'status', anterior: 'Aguardando aprovação', novo: aprov.decisao }], departamentoId: colab.departamentoId,
      });
    }
  };

  const regs: Reg[] = [
    { colab: 'usr-03', ferr: 'fer-gemini', caso: 'cu-01', processo: 'Comunicação e campanhas', atividade: 'Rascunho de posts para redes sociais', finalidade: 'Criação de conteúdo', freq: 'Diária', inicio: -320, resp: 'usr-02', descDados: 'Textos institucionais públicos.', controles: ['ctl-01', 'ctl-03'], fim: 'auto' },
    { colab: 'usr-04', ferr: 'fer-gemini', caso: 'cu-01', processo: 'Comunicação e campanhas', atividade: 'Roteiros de vídeos institucionais', finalidade: 'Criação de conteúdo', freq: 'Semanal', inicio: -240, resp: 'usr-02', descDados: 'Briefings de campanha.', controles: ['ctl-01', 'ctl-03'], fim: 'auto', revisaoAtrasada: true },
    { colab: 'usr-02', ferr: 'fer-gemini', processo: 'Planejamento de marketing', atividade: 'Resumo de pesquisas de satisfação', finalidade: 'Análise de dados', freq: 'Mensal', inicio: -200, resp: 'usr-02', dados: { pessoal: true }, descDados: 'Respostas de pesquisa com nome do respondente.', ctx: { impactoProcesso: 'MEDIO' }, controles: ['ctl-01', 'ctl-02'], fim: 'auto' },
    { colab: 'usr-03', ferr: 'fer-claude', processo: 'Comunicação e campanhas', atividade: 'Estruturação do calendário editorial automatizado', finalidade: 'Automação', freq: 'Semanal', inicio: -45, resp: 'usr-02', descDados: 'Pautas internas.', ctx: { grauAutomacao: 'PARCIAL' }, controles: ['ctl-03', 'ctl-06'], fim: 'aguardando_decisao', aprovador: 'usr-02' },
    { colab: 'usr-06', ferr: 'fer-gemini', caso: 'cu-05', processo: 'Relacionamento', atividade: 'Sugestão de respostas a e-mails de clientes', finalidade: 'Atendimento', freq: 'Diária', inicio: -30, resp: 'usr-05', dados: { pessoal: true, cliente: true }, descDados: 'E-mails de clientes com dados de apólice.', ctx: { impactoProcesso: 'MEDIO' }, controles: ['ctl-01', 'ctl-02', 'ctl-03'], fim: 'analise' },
    { colab: 'usr-06', ferr: 'fer-chatgpt', processo: 'Propostas comerciais', atividade: 'Redação de propostas com dados de clientes', finalidade: 'Elaboração de documentos', freq: 'Semanal', inicio: -75, resp: 'usr-05', dados: { pessoal: true, cliente: true, contratual: true }, descDados: 'Dados cadastrais e condições comerciais.', ctx: { impactoProcesso: 'ALTO' }, controles: [], fim: 'reprovado', aprovador: 'usr-01' },
    { colab: 'usr-05', ferr: 'fer-perplexity', caso: 'cu-10', processo: 'Inteligência comercial', atividade: 'Pesquisa de tendências do mercado de seguros', finalidade: 'Pesquisa', freq: 'Quinzenal', inicio: -150, resp: 'usr-05', descDados: 'Somente fontes públicas.', controles: ['ctl-04'], fim: 'restricao', aprovador: 'usr-01' },
    { colab: 'usr-08', ferr: 'fer-sinistro', caso: 'cu-04', processo: 'Regulação de sinistros', atividade: 'Triagem automática de avisos de sinistro', finalidade: 'Automação', freq: 'Diária', inicio: -260, resp: 'usr-07', dados: { pessoal: true, cliente: true, sensivel: true }, descDados: 'Laudos médicos e documentos do segurado.', ctx: { impactoProcesso: 'ALTO', grauAutomacao: 'PARCIAL', decisaoHumana: 'SEMPRE' }, controles: ['ctl-03', 'ctl-07'], fim: 'restricao', aprovador: 'usr-01', sensivel: { tipo: 'Dados de saúde (laudos)', finalidade: 'Triagem de sinistros de vida/saúde', existeAutorizacao: true, controle: 'DPA com fornecedor + revisão humana', responsavelId: 'usr-07' } },
    { colab: 'usr-07', ferr: 'fer-gemini', processo: 'Regulação de sinistros', atividade: 'Resumo de processos de sinistro para comitê', finalidade: 'Análise de dados', freq: 'Semanal', inicio: -20, resp: 'usr-07', dados: { pessoal: true, cliente: true, sensivel: true }, descDados: 'Histórico do sinistro com informações de saúde.', ctx: { impactoProcesso: 'ALTO' }, controles: ['ctl-01'], fim: 'aguardando_decisao', aprovador: 'usr-01', sensivel: { tipo: 'Dados de saúde', finalidade: 'Apoio a comitê', existeAutorizacao: false, controle: 'A definir', responsavelId: 'usr-07' } },
    { colab: 'usr-10', ferr: 'fer-gemini', caso: 'cu-02', processo: 'Fechamento mensal', atividade: 'Comentário de indicadores do DRE', finalidade: 'Análise de dados', freq: 'Mensal', inicio: -180, resp: 'usr-09', dados: { financeiro: true }, descDados: 'DRE gerencial.', ctx: { impactoProcesso: 'MEDIO' }, controles: ['ctl-01', 'ctl-03'], fim: 'auto' },
    { colab: 'usr-09', ferr: 'fer-gemini', processo: 'Planejamento financeiro', atividade: 'Cenários de orçamento anual', finalidade: 'Análise de dados', freq: 'Eventual', inicio: -100, resp: 'usr-09', dados: { financeiro: true, estrategico: true }, descDados: 'Premissas orçamentárias.', ctx: { impactoProcesso: 'ALTO' }, controles: ['ctl-01'], fim: 'auto', revisaoAtrasada: true },
    { colab: 'usr-10', ferr: 'fer-claude', processo: 'Conciliação', atividade: 'Script de conciliação bancária', finalidade: 'Automação', freq: 'Diária', inicio: -60, resp: 'usr-09', dados: { financeiro: true }, descDados: 'Extratos bancários sem identificação de clientes.', ctx: { impactoProcesso: 'ALTO', grauAutomacao: 'AUTOMATIZADO', decisaoHumana: 'AMOSTRAL' }, controles: ['ctl-03', 'ctl-06'], fim: 'homologacao', aprovador: 'usr-01' },
    { colab: 'usr-11', ferr: 'fer-gemini', caso: 'cu-08', processo: 'Gestão contratual', atividade: 'Resumo de cláusulas de contratos de fornecedores', finalidade: 'Análise documental', freq: 'Semanal', inicio: -15, resp: '', dados: { contratual: true, estrategico: true }, descDados: 'Contratos com fornecedores.', ctx: { impactoProcesso: 'MEDIO' }, controles: ['ctl-01'], fim: 'analise' },
    { colab: 'usr-14', ferr: 'fer-claude', caso: 'cu-06', processo: 'Desenvolvimento de sistemas', atividade: 'Apoio ao desenvolvimento do portal do corretor', finalidade: 'Programação', freq: 'Diária', inicio: -110, resp: 'usr-01', descDados: 'Código-fonte sem credenciais.', ctx: { impactoProcesso: 'MEDIO' }, controles: ['ctl-03', 'ctl-06'], fim: 'aprovado', aprovador: 'usr-01' },
    { colab: 'usr-14', ferr: 'fer-claude', caso: 'cu-03', processo: 'Automação interna', atividade: 'Automação do inventário de acessos', finalidade: 'Automação', freq: 'Semanal', inicio: -90, resp: 'usr-01', dados: { pessoal: true }, descDados: 'Lista de usuários e perfis.', ctx: { impactoProcesso: 'MEDIO', grauAutomacao: 'PARCIAL' }, controles: ['ctl-02', 'ctl-03'], fim: 'aprovado', aprovador: 'usr-01' },
    { colab: 'usr-14', ferr: 'fer-copilot', processo: 'Desenvolvimento de sistemas', atividade: 'Geração de código em repositório de pagamentos', finalidade: 'Programação', freq: 'Diária', inicio: -130, resp: 'usr-01', dados: { estrategico: true }, descDados: 'Código de sistema de pagamentos.', ctx: { impactoProcesso: 'ALTO' }, controles: [], fim: 'suspenso', aprovador: 'usr-01' },
    { colab: 'usr-12', ferr: 'fer-gemini', caso: 'cu-09', processo: 'Planejamento estratégico', atividade: 'Preparação de pautas do Conselho', finalidade: 'Suporte à Diretoria', freq: 'Mensal', inicio: -210, resp: 'usr-12', dados: { estrategico: true }, descDados: 'Materiais de reunião.', ctx: { impactoProcesso: 'MEDIO' }, controles: ['ctl-01', 'ctl-03'], fim: 'auto' },
    { colab: 'usr-04', ferr: 'fer-chatgpt', processo: 'Comunicação e campanhas', atividade: 'Geração de imagens para campanha', finalidade: 'Criação de conteúdo', freq: 'Eventual', inicio: -280, resp: 'usr-02', descDados: 'Sem dados corporativos.', controles: [], fim: 'encerrado', aprovador: 'usr-01' },
  ];
  regs.forEach(criarReg);

  // ------------------------------------------------------------------- Riscos
  const risco = (id: string, codigo: string, titulo: string, descricao: string, categoria: RiscoIA['categoria'], probabilidade: RiscoIA['probabilidade'], impacto: RiscoIA['impacto'], responsavelId: ID, controleIds: ID[], ferramentaIds: ID[], status: RiscoIA['status']): RiscoIA =>
    ({ id, codigo, titulo, descricao, categoria, probabilidade, impacto, nivel: nivelMatriz(probabilidade, impacto), responsavelId, controleIds, ferramentaIds, status });
  const riscos: RiscoIA[] = [
    risco('rsk-01', 'RIA-01', 'Vazamento de dados de clientes via IA pública', 'Inserção de dados de clientes em ferramentas públicas não homologadas.', 'Privacidade / LGPD', 4, 5, 'usr-01', ['ctl-04', 'ctl-05'], ['fer-chatgpt', 'fer-perplexity', 'fer-copilot'], 'Em tratamento'),
    risco('rsk-02', 'RIA-02', 'Decisão automatizada sem revisão humana', 'Automação que afeta clientes sem validação por pessoa.', 'Operacional', 2, 4, 'usr-07', ['ctl-03'], ['fer-sinistro'], 'Em tratamento'),
    risco('rsk-03', 'RIA-03', 'Resultado incorreto (alucinação) usado em documento oficial', 'Conteúdo gerado sem conferência utilizado externamente.', 'Reputacional', 3, 3, 'usr-02', ['ctl-03'], ['fer-gemini', 'fer-claude'], 'Mitigado'),
    risco('rsk-04', 'RIA-04', 'Uso de ferramenta não homologada (shadow AI)', 'Colaboradores adotando ferramentas sem avaliação.', 'Segurança da informação', 4, 3, 'usr-01', ['ctl-05', 'ctl-06'], ['fer-chatgpt', 'fer-copilot', 'fer-perplexity'], 'Identificado'),
    risco('rsk-05', 'RIA-05', 'Exposição de código e segredos em assistentes de programação', 'Credenciais ou código proprietário enviados a serviços externos.', 'Segurança da informação', 2, 5, 'usr-01', ['ctl-06'], ['fer-claude', 'fer-copilot'], 'Em tratamento'),
  ];

  // --------------------------------------------------------------- Incidentes
  const incidentes: Incidente[] = [
    { id: 'inc-01', codigo: 'INC-001', data: d(-70), colaboradorId: 'usr-06', ferramentaId: 'fer-chatgpt', tipo: 'Envio de informação não autorizada', descricao: 'Proposta com dados de cliente colada em IA pública.', dadosEnvolvidos: 'Nome, CPF e condições comerciais de 1 cliente.', impacto: 'ALTO', risco: 'ALTO', responsavelId: 'usr-01', acaoTomada: 'Orientação ao colaborador, exclusão do histórico e registro no comitê LGPD.', status: 'Resolvido', dataEncerramento: d(-60) },
    { id: 'inc-02', codigo: 'INC-002', data: d(-12), colaboradorId: 'usr-14', ferramentaId: 'fer-copilot', tipo: 'Ferramenta não homologada', descricao: 'Uso de assistente não homologado em repositório de pagamentos.', dadosEnvolvidos: 'Trechos de código-fonte.', impacto: 'MEDIO', risco: 'ALTO', responsavelId: 'usr-01', acaoTomada: 'Uso suspenso; avaliação de exposição em andamento.', status: 'Em tratamento' },
    { id: 'inc-03', codigo: 'INC-003', data: d(-5), colaboradorId: 'usr-03', ferramentaId: 'fer-gemini', tipo: 'Resultado incorreto', descricao: 'Texto de campanha com informação de cobertura incorreta identificado antes da publicação.', dadosEnvolvidos: 'Nenhum dado pessoal.', impacto: 'BAIXO', risco: 'MEDIO', responsavelId: 'usr-02', acaoTomada: '', status: 'Aberto' },
  ];

  // -------------------------------------------------------------- Treinamentos
  const treinamentos: Treinamento[] = [
    { id: 'trn-01', titulo: 'Uso Responsável de IA — Fundamentos', descricao: 'Política, riscos e boas práticas de uso de IA.', obrigatorio: true, cargaHoraria: 2, validadeMeses: 12 },
    { id: 'trn-02', titulo: 'Proteção de Dados e LGPD aplicada à IA', descricao: 'O que pode e o que não pode ser inserido em ferramentas de IA.', obrigatorio: true, cargaHoraria: 2, validadeMeses: 12 },
    { id: 'trn-03', titulo: 'Google Gemini no Workspace', descricao: 'Uso produtivo e seguro da ferramenta homologada.', obrigatorio: false, cargaHoraria: 3, validadeMeses: 24 },
    { id: 'trn-04', titulo: 'Engenharia de prompts', descricao: 'Técnicas para resultados melhores e verificáveis.', obrigatorio: false, cargaHoraria: 4, validadeMeses: 24 },
    { id: 'trn-05', titulo: 'Automação com IA e revisão humana', descricao: 'Desenho de automações com controles e responsáveis.', obrigatorio: false, cargaHoraria: 3, validadeMeses: 12 },
  ];

  const participacoes: Participacao[] = [];
  let pseq = 0;
  const part = (colaboradorId: ID, treinamentoId: ID, diasAtras: number | null, status: Participacao['status'] = 'Concluído') => {
    const t = treinamentos.find(x => x.id === treinamentoId)!;
    const data = diasAtras === null ? undefined : d(-diasAtras);
    participacoes.push({
      id: `par-${++pseq}`, treinamentoId, colaboradorId, data, status, certificado: status === 'Concluído',
      proximaReciclagem: status === 'Concluído' && data ? addMeses(data, t.validadeMeses) : undefined,
    });
  };
  // Treinados em dia
  for (const id of ['usr-01', 'usr-02', 'usr-03', 'usr-05', 'usr-07', 'usr-09', 'usr-12', 'usr-13', 'usr-14']) {
    part(id, 'trn-01', 90);
    part(id, 'trn-02', 80);
  }
  // Vencido (reciclagem expirada)
  part('usr-10', 'trn-01', 400);
  part('usr-10', 'trn-02', 390);
  // Pendentes
  part('usr-04', 'trn-01', 30);
  part('usr-06', 'trn-01', null, 'Em andamento');
  part('usr-08', 'trn-01', null, 'Pendente');
  part('usr-11', 'trn-02', 10);
  // Complementares
  part('usr-03', 'trn-03', 60);
  part('usr-14', 'trn-04', 45);
  part('usr-01', 'trn-05', 20);
  part('usr-10', 'trn-05', null, 'Em andamento');

  // ---------------------------------------------------------------- Melhorias
  const melhorias: Melhoria[] = [
    { id: 'mel-01', titulo: 'Habilitar DLP para prompts no Workspace', descricao: 'Estender regras de DLP ao Gemini.', origem: 'Incidente', status: 'Em implantação', responsavelId: 'usr-01', data: d(-55) },
    { id: 'mel-02', titulo: 'Modelo de anonimização para Sinistros', descricao: 'Planilha/rotina padrão para anonimizar laudos.', origem: 'Revisão', status: 'Identificada', responsavelId: 'usr-07', data: d(-25) },
    { id: 'mel-03', titulo: 'Trilha de treinamento por perfil', descricao: 'Conteúdo específico para desenvolvedores.', origem: 'Sugestão', status: 'Implantada', responsavelId: 'usr-01', data: d(-100) },
    { id: 'mel-04', titulo: 'Inventário automático de ferramentas de IA', descricao: 'Usar logs do Workspace para detectar IAs não homologadas.', origem: 'Auditoria', status: 'Identificada', responsavelId: 'usr-13', data: d(-8) },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    empresas, departamentos, usuarios, ferramentas, casosUso, registrosUso, aprovacoes, riscos, controles,
    treinamentos, participacoes, incidentes, politicas, melhorias,
    auditoria: auditoria.sort((a, b) => b.dataHora.localeCompare(a.dataHora)),
    alertasEstado: [],
    configuracoes: CONFIGURACOES_PADRAO,
  };
};
