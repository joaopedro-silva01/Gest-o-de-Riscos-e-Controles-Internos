/**
 * Listas de domínio e rótulos de exibição.
 * Centralizados aqui para que selects, badges, filtros e gráficos
 * usem sempre os mesmos valores.
 */
import type {
  CategoriaHomologacao,
  DecisaoHumana,
  EtapaFluxo,
  Frequencia,
  GrauAutomacao,
  ImpactoProcesso,
  NivelAlerta,
  NivelRisco,
  Perfil,
  StatusIncidente,
  StatusUso,
  TipoDadoFlag,
  TipoIncidente,
} from './types';

export const NIVEIS_RISCO: NivelRisco[] = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'];

export const NIVEL_RISCO_LABEL: Record<NivelRisco, string> = {
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
  CRITICO: 'Crítico',
};

export const NIVEL_RISCO_ORDEM: Record<NivelRisco, number> = { BAIXO: 0, MEDIO: 1, ALTO: 2, CRITICO: 3 };

/**
 * Cores de risco (também usadas nos gráficos). Paleta validada para daltonismo
 * (skill dataviz / validate_palette): sempre exibida com rótulo textual ao lado.
 */
export const NIVEL_RISCO_COR: Record<NivelRisco, string> = {
  BAIXO: '#2f855a',
  MEDIO: '#b7950b',
  ALTO: '#d9480f',
  CRITICO: '#9b1c1c',
};

/** Cores de homologação nos gráficos (validadas; exigem rótulo direto). */
export const CATEGORIA_COR: Record<CategoriaHomologacao, string> = {
  HOMOLOGADA: '#2f6fb0',
  USO_MEDIANTE_APROVACAO: '#c9a227',
  NAO_HOMOLOGADA: '#b91c1c',
};

export const CATEGORIAS_HOMOLOGACAO: CategoriaHomologacao[] = [
  'HOMOLOGADA',
  'USO_MEDIANTE_APROVACAO',
  'NAO_HOMOLOGADA',
];

export const CATEGORIA_LABEL: Record<CategoriaHomologacao, string> = {
  HOMOLOGADA: 'Homologada',
  USO_MEDIANTE_APROVACAO: 'Uso mediante aprovação',
  NAO_HOMOLOGADA: 'Não homologada / Uso restrito',
};

export const STATUS_USO: StatusUso[] = [
  'Em análise',
  'Aguardando aprovação',
  'Aprovado',
  'Aprovado com restrições',
  'Em monitoramento',
  'Suspenso',
  'Não aprovado',
  'Encerrado',
];

/** Status considerados "uso autorizado/ativo". */
export const STATUS_AUTORIZADOS: StatusUso[] = ['Aprovado', 'Aprovado com restrições', 'Em monitoramento'];
/** Status considerados "pendentes de decisão". */
export const STATUS_PENDENTES: StatusUso[] = ['Em análise', 'Aguardando aprovação'];

export const FREQUENCIAS: Frequencia[] = ['Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Eventual'];

export const TIPOS_DADO: TipoDadoFlag[] = ['pessoal', 'sensivel', 'cliente', 'financeiro', 'contratual', 'estrategico'];

export const TIPO_DADO_LABEL: Record<TipoDadoFlag, string> = {
  pessoal: 'Dado pessoal',
  sensivel: 'Dado sensível',
  cliente: 'Dado de cliente',
  financeiro: 'Informação financeira',
  contratual: 'Informação contratual',
  estrategico: 'Estratégica / confidencial',
};

export const TIPO_DADO_PERGUNTA: Record<TipoDadoFlag, string> = {
  pessoal: 'Existe dado pessoal?',
  sensivel: 'Existe dado sensível?',
  cliente: 'Existe dado de cliente?',
  financeiro: 'Existe informação financeira?',
  contratual: 'Existe informação contratual?',
  estrategico: 'Existe informação estratégica / confidencial?',
};

export const TIPO_DADO_AJUDA: Record<TipoDadoFlag, string> = {
  pessoal: 'Nome, CPF, e-mail, telefone, endereço de uma pessoa identificável.',
  sensivel: 'Saúde, biometria, origem racial, religião, opinião política, vida sexual (LGPD art. 5º, II).',
  cliente: 'Apólices, sinistros, cadastros, histórico ou qualquer dado de clientes.',
  financeiro: 'Resultados, fluxo de caixa, faturamento, dados bancários.',
  contratual: 'Cláusulas, minutas, contratos com clientes, parceiros ou fornecedores.',
  estrategico: 'Planejamento, M&A, precificação, informações de Diretoria.',
};

export const IMPACTO_LABEL: Record<ImpactoProcesso, string> = { BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto' };
export const AUTOMACAO_LABEL: Record<GrauAutomacao, string> = {
  ASSISTIDO: 'Assistido (apoio pontual)',
  PARCIAL: 'Parcial (etapas automatizadas)',
  AUTOMATIZADO: 'Automatizado (ponta a ponta)',
};
export const DECISAO_LABEL: Record<DecisaoHumana, string> = {
  SEMPRE: 'Sempre revisado por pessoa',
  AMOSTRAL: 'Revisão amostral',
  SEM_REVISAO: 'Sem revisão humana',
};

export const ETAPAS_FLUXO: EtapaFluxo[] = [
  'SOLICITACAO',
  'ANALISE',
  'CLASSIFICACAO_RISCO',
  'AVALIACAO_DADOS',
  'APROVACAO',
  'HOMOLOGACAO',
  'MONITORAMENTO',
  'REVISAO',
];

export const ETAPA_LABEL: Record<EtapaFluxo, string> = {
  SOLICITACAO: 'Solicitação',
  ANALISE: 'Análise',
  CLASSIFICACAO_RISCO: 'Classificação de risco',
  AVALIACAO_DADOS: 'Avaliação de dados',
  APROVACAO: 'Aprovação',
  HOMOLOGACAO: 'Homologação',
  MONITORAMENTO: 'Monitoramento',
  REVISAO: 'Revisão',
};

export const PERFIS: Perfil[] = ['ADMINISTRADOR', 'GESTOR', 'AUDITOR', 'COLABORADOR', 'DIRETORIA'];

export const PERFIL_LABEL: Record<Perfil, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTOR: 'Gestor',
  AUDITOR: 'Auditor',
  COLABORADOR: 'Colaborador',
  DIRETORIA: 'Diretoria',
};

export const TIPOS_INCIDENTE: TipoIncidente[] = [
  'Uso indevido',
  'Envio de informação não autorizada',
  'Ferramenta não homologada',
  'Vazamento',
  'Resultado incorreto',
  'Falha de automação',
  'Violação de política',
  'Outro',
];

export const STATUS_INCIDENTE: StatusIncidente[] = ['Aberto', 'Em análise', 'Em tratamento', 'Resolvido', 'Encerrado'];
export const STATUS_INCIDENTE_ABERTO: StatusIncidente[] = ['Aberto', 'Em análise', 'Em tratamento'];

export const NIVEL_ALERTA_LABEL: Record<NivelAlerta, string> = {
  INFORMATIVO: 'Informativo',
  ATENCAO: 'Atenção',
  ALERTA: 'Alerta',
  CRITICO: 'Crítico',
};
export const NIVEL_ALERTA_ORDEM: Record<NivelAlerta, number> = { INFORMATIVO: 0, ATENCAO: 1, ALERTA: 2, CRITICO: 3 };

/** Cor única para gráficos de série única (magnitude por categoria). */
export const COR_SERIE = '#1d4e89';

/** Finalidades sugeridas no cadastro (texto livre também é aceito). */
export const FINALIDADES = [
  'Criação de conteúdo',
  'Análise de dados',
  'Análise documental',
  'Atendimento',
  'Automação',
  'Programação',
  'Pesquisa',
  'Elaboração de documentos',
  'Suporte à Diretoria',
];
