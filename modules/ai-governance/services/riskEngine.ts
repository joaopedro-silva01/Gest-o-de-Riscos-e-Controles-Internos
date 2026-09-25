/**
 * Motor de classificação de risco de uso de IA.
 *
 * CRÍTICO: o cálculo precisa ser TRANSPARENTE (seção 5 da especificação).
 * Por isso a função devolve, além do nível, a lista de fatores com os pontos
 * atribuídos e o motivo de cada um, e as regras de piso que elevaram o nível.
 * Nenhum fator é somado sem aparecer em `fatores`.
 *
 * Os pesos vêm de `Configuracoes.pesosRisco` (editáveis pelo Administrador).
 */
import { CATEGORIA_LABEL, NIVEL_RISCO_LABEL, NIVEL_RISCO_ORDEM, TIPOS_DADO, TIPO_DADO_LABEL, IMPACTO_LABEL, AUTOMACAO_LABEL, DECISAO_LABEL } from '../domain/catalogs';
import type {
  ClassificacaoDados,
  ContextoRisco,
  FatorRisco,
  FerramentaIA,
  NivelRisco,
  PesosRisco,
  RegistroUso,
  ResultadoRisco,
} from '../domain/types';

export const PESOS_PADRAO: PesosRisco = {
  categoria: { HOMOLOGADA: 0, USO_MEDIANTE_APROVACAO: 2, NAO_HOMOLOGADA: 4 },
  exposicaoExterna: 2,
  dados: { pessoal: 2, sensivel: 4, cliente: 3, financeiro: 2, contratual: 2, estrategico: 3 },
  impactoProcesso: { BAIXO: 0, MEDIO: 1, ALTO: 3 },
  grauAutomacao: { ASSISTIDO: 0, PARCIAL: 1, AUTOMATIZADO: 3 },
  decisaoHumana: { SEMPRE: 0, AMOSTRAL: 1, SEM_REVISAO: 3 },
  faixas: { medio: 5, alto: 10, critico: 16 },
};

export const maiorNivel = (a: NivelRisco, b: NivelRisco): NivelRisco =>
  NIVEL_RISCO_ORDEM[a] >= NIVEL_RISCO_ORDEM[b] ? a : b;

export const nivelPorPontuacao = (pontos: number, faixas: PesosRisco['faixas']): NivelRisco => {
  if (pontos >= faixas.critico) return 'CRITICO';
  if (pontos >= faixas.alto) return 'ALTO';
  if (pontos >= faixas.medio) return 'MEDIO';
  return 'BAIXO';
};

export interface EntradaRisco {
  ferramenta: Pick<FerramentaIA, 'nome' | 'categoria' | 'exposicaoExterna'>;
  dados: ClassificacaoDados;
  contexto: ContextoRisco;
}

export const calcularRisco = ({ ferramenta, dados, contexto }: EntradaRisco, pesos: PesosRisco = PESOS_PADRAO): ResultadoRisco => {
  const fatores: FatorRisco[] = [];
  const add = (fator: string, pontos: number, motivo: string) => {
    // Fatores com zero ponto também são listados: mostram que foram avaliados.
    fatores.push({ fator, pontos, motivo });
  };

  add(
    'Tipo de ferramenta',
    pesos.categoria[ferramenta.categoria],
    `${ferramenta.nome} está classificada como "${CATEGORIA_LABEL[ferramenta.categoria]}".`,
  );

  if (ferramenta.exposicaoExterna) {
    add('Exposição externa', pesos.exposicaoExterna, 'Os dados inseridos saem do ambiente corporativo controlado.');
  }

  for (const tipo of TIPOS_DADO) {
    if (dados[tipo]) add(TIPO_DADO_LABEL[tipo], pesos.dados[tipo], `Uso declara ${TIPO_DADO_LABEL[tipo].toLowerCase()}.`);
  }

  add('Impacto no processo', pesos.impactoProcesso[contexto.impactoProcesso], `Impacto ${IMPACTO_LABEL[contexto.impactoProcesso].toLowerCase()} no processo.`);
  add('Grau de automação', pesos.grauAutomacao[contexto.grauAutomacao], AUTOMACAO_LABEL[contexto.grauAutomacao] + '.');
  add('Decisão humana', pesos.decisaoHumana[contexto.decisaoHumana], DECISAO_LABEL[contexto.decisaoHumana] + '.');

  const pontuacao = fatores.reduce((s, f) => s + f.pontos, 0);
  const nivelCalculado = nivelPorPontuacao(pontuacao, pesos.faixas);

  // Regras de piso: situações que, independentemente da soma, exigem nível mínimo.
  let nivelSugerido = nivelCalculado;
  const regrasAplicadas: string[] = [];
  const naoHomologada = ferramenta.categoria === 'NAO_HOMOLOGADA';
  const piso = (nivel: NivelRisco, regra: string) => {
    if (NIVEL_RISCO_ORDEM[nivel] > NIVEL_RISCO_ORDEM[nivelSugerido]) {
      nivelSugerido = nivel;
      regrasAplicadas.push(`${regra} → mínimo ${NIVEL_RISCO_LABEL[nivel]}`);
    }
  };
  if (naoHomologada && dados.sensivel) piso('CRITICO', 'Dado sensível em ferramenta não homologada');
  if (naoHomologada && (dados.cliente || dados.contratual)) piso('ALTO', 'Dado de cliente/contratual em ferramenta não homologada');
  if (contexto.grauAutomacao === 'AUTOMATIZADO' && contexto.decisaoHumana === 'SEM_REVISAO')
    piso('ALTO', 'Processo automatizado sem revisão humana');

  // Necessidade de aprovação — também com motivos explícitos.
  const motivosAprovacao: string[] = [];
  if (ferramenta.categoria !== 'HOMOLOGADA') motivosAprovacao.push(`Ferramenta "${CATEGORIA_LABEL[ferramenta.categoria]}"`);
  if (NIVEL_RISCO_ORDEM[nivelSugerido] >= NIVEL_RISCO_ORDEM.ALTO) motivosAprovacao.push(`Risco ${NIVEL_RISCO_LABEL[nivelSugerido]}`);
  if (dados.sensivel) motivosAprovacao.push('Envolve dado sensível');
  if (dados.cliente) motivosAprovacao.push('Envolve dado de cliente');

  return {
    pontuacao,
    nivelCalculado,
    nivelSugerido,
    fatores,
    regrasAplicadas,
    necessitaAprovacao: motivosAprovacao.length > 0,
    motivosAprovacao,
  };
};

/** Nível efetivo de um registro: ajuste manual (auditado) prevalece sobre o sugerido. */
export const nivelEfetivo = (r: Pick<RegistroUso, 'risco' | 'ajusteRisco'>): NivelRisco =>
  r.ajusteRisco?.nivel ?? r.risco.nivelSugerido;

/** Nível do registro de riscos corporativos pela matriz probabilidade × impacto (1–25). */
export const nivelMatriz = (probabilidade: number, impacto: number): NivelRisco => {
  const score = probabilidade * impacto;
  if (score >= 20) return 'CRITICO';
  if (score >= 12) return 'ALTO';
  if (score >= 5) return 'MEDIO';
  return 'BAIXO';
};
