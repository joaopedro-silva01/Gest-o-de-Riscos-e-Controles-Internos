/**
 * Modelo de domínio do módulo "Governança e Segurança da IA".
 *
 * Fonte única da verdade das entidades. Cada interface corresponde a uma
 * tabela da seção 20 da especificação (ver docs/governanca-ia/ARQUITETURA.md).
 * Relacionamentos são feitos por ID — nunca duplicamos dados derivados
 * (ex.: o departamento de um registro de uso vem do colaborador).
 */

export type ID = string;
/** Data no formato ISO `YYYY-MM-DD`. */
export type ISODate = string;
/** Data/hora no formato ISO completo. */
export type ISODateTime = string;

// ---------------------------------------------------------------------------
// Enums de domínio (union types para serializar em JSON sem conversão)
// ---------------------------------------------------------------------------

export type Perfil = 'ADMINISTRADOR' | 'GESTOR' | 'AUDITOR' | 'COLABORADOR' | 'DIRETORIA';

export type NivelRisco = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';

/** Categoria de homologação da ferramenta (seção 3). */
export type CategoriaHomologacao = 'HOMOLOGADA' | 'USO_MEDIANTE_APROVACAO' | 'NAO_HOMOLOGADA';

export type TipoFerramenta =
  | 'Corporativa integrada'
  | 'Pública (SaaS)'
  | 'Embarcada em fornecedor'
  | 'Interna';

export type StatusFerramenta = 'Ativa' | 'Em avaliação' | 'Suspensa' | 'Descontinuada';

export type UsoRecomendado = 'Prioritário' | 'Controlado' | 'Restrito';

export type StatusUso =
  | 'Em análise'
  | 'Aguardando aprovação'
  | 'Aprovado'
  | 'Aprovado com restrições'
  | 'Em monitoramento'
  | 'Suspenso'
  | 'Não aprovado'
  | 'Encerrado';

export type Frequencia = 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Eventual';

export type ImpactoProcesso = 'BAIXO' | 'MEDIO' | 'ALTO';
export type GrauAutomacao = 'ASSISTIDO' | 'PARCIAL' | 'AUTOMATIZADO';
export type DecisaoHumana = 'SEMPRE' | 'AMOSTRAL' | 'SEM_REVISAO';

/** Flags de classificação de dados (seção 4). */
export interface ClassificacaoDados {
  pessoal: boolean;
  sensivel: boolean;
  cliente: boolean;
  financeiro: boolean;
  contratual: boolean;
  estrategico: boolean;
}
export type TipoDadoFlag = keyof ClassificacaoDados;

/** Campos condicionais abertos quando há dado sensível (seção 26). */
export interface DetalheDadoSensivel {
  tipo: string;
  finalidade: string;
  existeAutorizacao: boolean;
  controle: string;
  responsavelId: ID;
}

/** Fatores de contexto usados pela matriz de risco. */
export interface ContextoRisco {
  impactoProcesso: ImpactoProcesso;
  grauAutomacao: GrauAutomacao;
  decisaoHumana: DecisaoHumana;
}

/** Contribuição individual de um fator — base da transparência do cálculo. */
export interface FatorRisco {
  fator: string;
  pontos: number;
  motivo: string;
}

export interface ResultadoRisco {
  pontuacao: number;
  nivelCalculado: NivelRisco;
  /** Nível após regras de piso (sempre >= nivelCalculado). */
  nivelSugerido: NivelRisco;
  fatores: FatorRisco[];
  regrasAplicadas: string[];
  necessitaAprovacao: boolean;
  motivosAprovacao: string[];
}

/** Ajuste manual do nível sugerido — exige justificativa e fica auditado. */
export interface AjusteRisco {
  nivel: NivelRisco;
  justificativa: string;
  responsavelId: ID;
  data: ISODateTime;
}

export type EtapaFluxo =
  | 'SOLICITACAO'
  | 'ANALISE'
  | 'CLASSIFICACAO_RISCO'
  | 'AVALIACAO_DADOS'
  | 'APROVACAO'
  | 'HOMOLOGACAO'
  | 'MONITORAMENTO'
  | 'REVISAO';

export type StatusEtapa = 'Pendente' | 'Em andamento' | 'Concluída' | 'Reprovada' | 'Não aplicável';

export type TipoIncidente =
  | 'Uso indevido'
  | 'Envio de informação não autorizada'
  | 'Ferramenta não homologada'
  | 'Vazamento'
  | 'Resultado incorreto'
  | 'Falha de automação'
  | 'Violação de política'
  | 'Outro';

export type StatusIncidente = 'Aberto' | 'Em análise' | 'Em tratamento' | 'Resolvido' | 'Encerrado';

export type StatusTreinamento = 'Concluído' | 'Em andamento' | 'Pendente' | 'Vencido';

export type NivelAlerta = 'INFORMATIVO' | 'ATENCAO' | 'ALERTA' | 'CRITICO';

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export interface Empresa {
  id: ID;
  nome: string;
  sigla: string;
}

export interface Departamento {
  id: ID;
  nome: string;
  gestorId?: ID;
}

export interface Usuario {
  id: ID;
  nome: string;
  email: string;
  cargo: string;
  empresaId: ID;
  departamentoId: ID;
  perfil: Perfil;
  ativo: boolean;
  dataCadastro: ISODate;
}

export interface FerramentaIA {
  id: ID;
  nome: string;
  fornecedor: string;
  categoria: CategoriaHomologacao;
  tipo: TipoFerramenta;
  url: string;
  status: StatusFerramenta;
  usoRecomendado: UsoRecomendado;
  descricao: string;
  /** Dados inseridos saem do ambiente corporativo controlado? */
  exposicaoExterna: boolean;
  dataHomologacao?: ISODate;
  responsavelHomologacaoId?: ID;
  nivelRisco: NivelRisco;
  permissoes: string[];
  restricoes: string[];
  observacoes: string;
  politicaId?: ID;
  ultimaRevisao?: ISODate;
}

/** Biblioteca de casos de uso (modelo reutilizável — seção 9). */
export interface CasoUso {
  id: ID;
  nome: string;
  departamentoId: ID;
  processo: string;
  ferramentaIds: ID[];
  objetivo: string;
  beneficioEsperado: string;
  dadosUtilizados: TipoDadoFlag[];
  nivelRisco: NivelRisco;
  status: 'Ativo' | 'Em avaliação' | 'Descontinuado';
  responsavelId?: ID;
  aprovado: boolean;
  controleIds: ID[];
  ultimaRevisao?: ISODate;
}

/** Registro de Uso de IA — instância concreta de uso (seção 4). */
export interface RegistroUso {
  id: ID;
  codigo: string;
  colaboradorId: ID;
  ferramentaId: ID;
  casoUsoId?: ID;
  processo: string;
  atividade: string;
  finalidade: string;
  frequencia: Frequencia;
  dataInicio: ISODate;
  responsavelProcessoId: ID;
  dados: ClassificacaoDados;
  descricaoDados: string;
  detalheSensivel?: DetalheDadoSensivel;
  contexto: ContextoRisco;
  /** Snapshot do cálculo no momento da última avaliação. */
  risco: ResultadoRisco;
  ajusteRisco?: AjusteRisco;
  aprovacaoId?: ID;
  controleIds: ID[];
  observacoes: string;
  ultimaRevisao?: ISODate;
  proximaRevisao?: ISODate;
  status: StatusUso;
  criadoEm: ISODateTime;
  criadoPorId: ID;
}

export interface EtapaAprovacao {
  etapa: EtapaFluxo;
  status: StatusEtapa;
  responsavelId?: ID;
  data?: ISODateTime;
  observacao?: string;
}

/** Fluxo de homologação de um registro de uso (seção 10). */
export interface Aprovacao {
  id: ID;
  registroUsoId: ID;
  solicitanteId: ID;
  dataSolicitacao: ISODateTime;
  etapas: EtapaAprovacao[];
  decisao?: 'Aprovado' | 'Aprovado com restrições' | 'Não aprovado';
  aprovadorId?: ID;
  dataDecisao?: ISODateTime;
  justificativa?: string;
  automatica: boolean;
}

/** Registro corporativo de riscos de IA. */
export interface RiscoIA {
  id: ID;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: 'Segurança da informação' | 'Privacidade / LGPD' | 'Operacional' | 'Regulatório' | 'Reputacional';
  probabilidade: 1 | 2 | 3 | 4 | 5;
  impacto: 1 | 2 | 3 | 4 | 5;
  nivel: NivelRisco;
  responsavelId?: ID;
  controleIds: ID[];
  ferramentaIds: ID[];
  status: 'Identificado' | 'Em tratamento' | 'Mitigado' | 'Aceito';
}

export interface Controle {
  id: ID;
  nome: string;
  descricao: string;
  tipo: 'Preventivo' | 'Detectivo' | 'Corretivo';
  responsavelId?: ID;
  efetividade: 'Efetivo' | 'Parcial' | 'Não avaliado';
}

export interface Treinamento {
  id: ID;
  titulo: string;
  descricao: string;
  obrigatorio: boolean;
  cargaHoraria: number;
  validadeMeses: number;
}

export interface Participacao {
  id: ID;
  treinamentoId: ID;
  colaboradorId: ID;
  data?: ISODate;
  status: Exclude<StatusTreinamento, 'Vencido'>;
  certificado: boolean;
  /** Data limite da reciclagem — se passada, o status efetivo é "Vencido". */
  proximaReciclagem?: ISODate;
}

export interface Incidente {
  id: ID;
  codigo: string;
  data: ISODate;
  colaboradorId?: ID;
  /** Usado apenas quando não há colaborador identificado. */
  departamentoId?: ID;
  ferramentaId?: ID;
  registroUsoId?: ID;
  tipo: TipoIncidente;
  descricao: string;
  dadosEnvolvidos: string;
  impacto: NivelRisco;
  risco: NivelRisco;
  responsavelId?: ID;
  acaoTomada: string;
  status: StatusIncidente;
  dataEncerramento?: ISODate;
}

export interface RegraPolitica {
  id: ID;
  tipo:
    | 'Dados permitidos'
    | 'Dados proibidos'
    | 'Ferramentas autorizadas'
    | 'Ferramentas restritas'
    | 'Necessidade de aprovação'
    | 'Responsabilidades'
    | 'IA generativa'
    | 'Automações'
    | 'Dados de clientes';
  descricao: string;
}

export interface VersaoPolitica {
  versao: string;
  data: ISODate;
  responsavelId: ID;
  alteracoes: string;
}

export interface Politica {
  id: ID;
  titulo: string;
  descricao: string;
  versaoAtual: string;
  status: 'Vigente' | 'Em revisão' | 'Rascunho' | 'Revogada';
  vigenciaAte: ISODate;
  responsavelId?: ID;
  regras: RegraPolitica[];
  versoes: VersaoPolitica[];
}

export interface Melhoria {
  id: ID;
  titulo: string;
  descricao: string;
  origem: 'Incidente' | 'Auditoria' | 'Revisão' | 'Sugestão';
  status: 'Identificada' | 'Em implantação' | 'Implantada';
  responsavelId?: ID;
  data: ISODate;
}

export interface AlteracaoCampo {
  campo: string;
  anterior: unknown;
  novo: unknown;
}

export type Entidade =
  | 'Registro de uso'
  | 'Aprovação'
  | 'Ferramenta'
  | 'Caso de uso'
  | 'Colaborador'
  | 'Departamento'
  | 'Empresa'
  | 'Risco'
  | 'Controle'
  | 'Treinamento'
  | 'Participação'
  | 'Incidente'
  | 'Política'
  | 'Melhoria'
  | 'Alerta'
  | 'Configuração';

export type AcaoAuditoria =
  | 'CRIAÇÃO'
  | 'ALTERAÇÃO'
  | 'EXCLUSÃO'
  | 'SUBMISSÃO'
  | 'APROVAÇÃO'
  | 'REPROVAÇÃO'
  | 'AVANÇO DE ETAPA'
  | 'AJUSTE DE RISCO'
  | 'RECONHECIMENTO';

export interface EventoAuditoria {
  id: ID;
  dataHora: ISODateTime;
  usuarioId: ID;
  entidade: Entidade;
  registroId: ID;
  registroRotulo: string;
  acao: AcaoAuditoria;
  alteracoes: AlteracaoCampo[];
  /** Departamento relacionado — permite filtrar a trilha por área. */
  departamentoId?: ID;
}

/** Alertas são derivados; persistimos apenas o reconhecimento. */
export interface AlertaEstado {
  chave: string;
  reconhecidoPorId: ID;
  reconhecidoEm: ISODateTime;
}

export interface Alerta {
  chave: string;
  nivel: NivelAlerta;
  titulo: string;
  descricao: string;
  entidade: Entidade;
  registroId?: ID;
  departamentoId?: ID;
  /** Página do módulo onde o alerta é tratado. */
  destino: PaginaId;
}

/** Pesos da matriz de risco — editáveis em Configurações. */
export interface PesosRisco {
  categoria: Record<CategoriaHomologacao, number>;
  exposicaoExterna: number;
  dados: Record<TipoDadoFlag, number>;
  impactoProcesso: Record<ImpactoProcesso, number>;
  grauAutomacao: Record<GrauAutomacao, number>;
  decisaoHumana: Record<DecisaoHumana, number>;
  /** Limite inferior de cada faixa. */
  faixas: { medio: number; alto: number; critico: number };
}

export interface Configuracoes {
  pesosRisco: PesosRisco;
  /** Meses entre revisões conforme o nível de risco. */
  periodicidadeRevisaoMeses: Record<NivelRisco, number>;
  /** Dias sem revisão para gerar alerta de ferramenta. */
  diasRevisaoFerramenta: number;
  /** Antecedência (dias) para alertar vencimento de política. */
  diasAvisoPolitica: number;
}

/** "Banco de dados" do módulo — um documento por coleção. */
export interface GovernanceDB {
  schemaVersion: number;
  empresas: Empresa[];
  departamentos: Departamento[];
  usuarios: Usuario[];
  ferramentas: FerramentaIA[];
  casosUso: CasoUso[];
  registrosUso: RegistroUso[];
  aprovacoes: Aprovacao[];
  riscos: RiscoIA[];
  controles: Controle[];
  treinamentos: Treinamento[];
  participacoes: Participacao[];
  incidentes: Incidente[];
  politicas: Politica[];
  melhorias: Melhoria[];
  auditoria: EventoAuditoria[];
  alertasEstado: AlertaEstado[];
  configuracoes: Configuracoes;
}

export type PaginaId =
  | 'visao-geral'
  | 'governanca'
  | 'colaboradores'
  | 'departamentos'
  | 'ferramentas'
  | 'casos-uso'
  | 'aprovacoes'
  | 'riscos-alertas'
  | 'incidentes'
  | 'treinamentos'
  | 'politicas'
  | 'auditoria'
  | 'configuracoes';

/** Filtros globais (seção 17). Strings vazias = sem filtro. */
export interface FiltrosGlobais {
  empresaId: string;
  departamentoId: string;
  colaboradorId: string;
  ferramentaId: string;
  status: string;
  nivelRisco: string;
  tipoDado: string;
  periodoInicio: string;
  periodoFim: string;
  responsavelId: string;
  homologacao: string;
}
