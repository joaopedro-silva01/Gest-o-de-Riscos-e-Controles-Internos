/**
 * Controle de acesso por perfil (RBAC) — seção 27.
 *
 * ATENÇÃO: nesta fase não existe backend nem autenticação. As regras abaixo
 * são aplicadas na interface e na camada de estado (GovernanceContext).
 * Em produção, as MESMAS regras devem ser validadas no servidor, com a
 * identidade vinda do SSO do Google Workspace.
 */
import { NIVEL_RISCO_ORDEM } from '../domain/catalogs';
import type { GovernanceDB, PaginaId, Perfil, RegistroUso, Usuario } from '../domain/types';
import { nivelEfetivo } from './riskEngine';

export type Permissao =
  | 'visao.executiva'
  | 'uso.registrar'
  | 'uso.editar'
  | 'aprovacao.decidir'
  | 'aprovacao.decidir_alto_risco'
  | 'ferramenta.gerenciar'
  | 'caso_uso.gerenciar'
  | 'politica.gerenciar'
  | 'treinamento.gerenciar'
  | 'incidente.registrar'
  | 'incidente.tratar'
  | 'risco.gerenciar'
  | 'alerta.reconhecer'
  | 'auditoria.visualizar'
  | 'configuracoes.gerenciar'
  | 'relatorio.exportar';

/** Escopo de dados visível para cada perfil. */
export type Escopo = 'TUDO' | 'DEPARTAMENTO' | 'PROPRIO';

const MATRIZ: Record<Perfil, { escopo: Escopo; permissoes: Permissao[] }> = {
  ADMINISTRADOR: {
    escopo: 'TUDO',
    permissoes: [
      'visao.executiva', 'uso.registrar', 'uso.editar', 'aprovacao.decidir', 'aprovacao.decidir_alto_risco',
      'ferramenta.gerenciar', 'caso_uso.gerenciar', 'politica.gerenciar', 'treinamento.gerenciar',
      'incidente.registrar', 'incidente.tratar', 'risco.gerenciar', 'alerta.reconhecer',
      'auditoria.visualizar', 'configuracoes.gerenciar', 'relatorio.exportar',
    ],
  },
  GESTOR: {
    escopo: 'DEPARTAMENTO',
    permissoes: [
      'visao.executiva', 'uso.registrar', 'uso.editar', 'aprovacao.decidir', 'caso_uso.gerenciar',
      'incidente.registrar', 'incidente.tratar', 'alerta.reconhecer', 'relatorio.exportar',
    ],
  },
  AUDITOR: {
    escopo: 'TUDO',
    permissoes: ['visao.executiva', 'incidente.registrar', 'auditoria.visualizar', 'relatorio.exportar'],
  },
  DIRETORIA: {
    escopo: 'TUDO',
    permissoes: ['visao.executiva', 'auditoria.visualizar', 'relatorio.exportar'],
  },
  COLABORADOR: {
    escopo: 'PROPRIO',
    permissoes: ['uso.registrar', 'incidente.registrar'],
  },
};

export const pode = (usuario: Usuario | undefined, permissao: Permissao): boolean =>
  !!usuario && MATRIZ[usuario.perfil].permissoes.includes(permissao);

export const escopoDe = (usuario: Usuario): Escopo => MATRIZ[usuario.perfil].escopo;

export const permissoesDe = (perfil: Perfil): Permissao[] => MATRIZ[perfil].permissoes;

/** Páginas visíveis por perfil. */
const PAGINAS_RESTRITAS: Partial<Record<PaginaId, Permissao>> = {
  auditoria: 'auditoria.visualizar',
  configuracoes: 'configuracoes.gerenciar',
};

export const podeAcessarPagina = (usuario: Usuario, pagina: PaginaId): boolean => {
  const req = PAGINAS_RESTRITAS[pagina];
  if (req) return pode(usuario, req);
  // Colaborador não vê as visões gerenciais consolidadas.
  if (usuario.perfil === 'COLABORADOR') return !['visao-geral', 'departamentos', 'riscos-alertas', 'aprovacoes'].includes(pagina);
  return true;
};

/** Página inicial adequada ao perfil. */
export const paginaInicial = (usuario: Usuario): PaginaId =>
  usuario.perfil === 'COLABORADOR' ? 'governanca' : 'visao-geral';

/**
 * Filtra os registros de uso conforme o escopo do usuário.
 * É o "row level security" do módulo: todas as telas partem deste recorte.
 */
export const registrosVisiveis = (db: GovernanceDB, usuario: Usuario): RegistroUso[] => {
  const escopo = escopoDe(usuario);
  if (escopo === 'TUDO') return db.registrosUso;
  if (escopo === 'PROPRIO') {
    return db.registrosUso.filter(r => r.colaboradorId === usuario.id || r.criadoPorId === usuario.id);
  }
  const depto = new Set(db.usuarios.filter(u => u.departamentoId === usuario.departamentoId).map(u => u.id));
  return db.registrosUso.filter(r => depto.has(r.colaboradorId) || r.responsavelProcessoId === usuario.id);
};

/** Usuários visíveis conforme escopo (usado em listas e seletores). */
export const usuariosVisiveis = (db: GovernanceDB, usuario: Usuario): Usuario[] => {
  const escopo = escopoDe(usuario);
  if (escopo === 'TUDO') return db.usuarios;
  if (escopo === 'PROPRIO') return db.usuarios.filter(u => u.id === usuario.id);
  return db.usuarios.filter(u => u.departamentoId === usuario.departamentoId);
};

/**
 * Pode decidir a aprovação deste registro?
 * - Alto/Crítico: somente quem tem 'aprovacao.decidir_alto_risco' (Administrador / Comitê).
 * - Gestor: apenas registros de colaboradores da sua área.
 * - Ninguém aprova a própria solicitação (segregação de funções).
 */
export const podeDecidir = (db: GovernanceDB, usuario: Usuario, registro: RegistroUso): { ok: boolean; motivo?: string } => {
  if (!pode(usuario, 'aprovacao.decidir')) return { ok: false, motivo: 'Seu perfil não aprova utilizações.' };
  if (registro.colaboradorId === usuario.id || registro.criadoPorId === usuario.id)
    return { ok: false, motivo: 'Segregação de funções: não é permitido aprovar a própria solicitação.' };
  const nivel = nivelEfetivo(registro);
  if (NIVEL_RISCO_ORDEM[nivel] >= NIVEL_RISCO_ORDEM.ALTO && !pode(usuario, 'aprovacao.decidir_alto_risco'))
    return { ok: false, motivo: 'Risco Alto/Crítico: aprovação restrita ao Administrador / Comitê de Governança.' };
  if (escopoDe(usuario) === 'DEPARTAMENTO') {
    const colab = db.usuarios.find(u => u.id === registro.colaboradorId);
    if (colab?.departamentoId !== usuario.departamentoId) return { ok: false, motivo: 'Registro de outra área.' };
  }
  return { ok: true };
};
