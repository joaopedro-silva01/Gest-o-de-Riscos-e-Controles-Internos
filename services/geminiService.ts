import { GoogleGenAI } from "@google/genai";
import { DocumentItem, RiskItem } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateStrategicAnalysis = async (
  risks: RiskItem[],
  documents: DocumentItem[],
  unitFilter: string
): Promise<string> => {
  
  const relevantRisks = unitFilter === 'All' ? risks : risks.filter(r => r.unit === unitFilter);
  const relevantDocs = unitFilter === 'All' ? documents : documents.filter(d => d.unit === unitFilter);

  // Prepare a concise summary for the prompt
  const riskSummary = relevantRisks.map(r => 
    `- ${r.title} (Nível: ${r.level}, Prob: ${r.probability}, Impacto: ${r.impact})`
  ).join('\n');

  const docSummary = relevantDocs.map(d => 
    `- ${d.title} (${d.type}, Status: ${d.status})`
  ).join('\n');

  const prompt = `
    Atue como um Diretor de Riscos Sênior (CRO) para uma instituição que possui operações de Seguradora e Meios de Pagamento (Ciclos Pay).
    
    Contexto Atual: ${unitFilter === 'All' ? 'Visão Geral Consolidada' : unitFilter}
    
    Dados de Risco Identificados:
    ${riskSummary}

    Estrutura Normativa (Políticas/Manuais) Existente:
    ${docSummary}

    Tarefa:
    Forneça uma análise estratégica executiva de 3 parágrafos.
    1. Identifique a principal vulnerabilidade com base nos riscos de alto impacto listados.
    2. Analise se a estrutura normativa atual (documentos listados) parece suficiente para mitigar esses riscos ou se há lacunas óbvias (ex: tem risco cibernético mas não tem política de segurança?).
    3. Recomende 3 ações imediatas para a diretoria.

    Responda em formato Markdown, profissional e direto. Use formatação como negrito para pontos chave.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Flash doesn't need thinking budget for this summary
      }
    });

    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Erro ao conectar com o serviço de inteligência artificial. Verifique sua chave de API.";
  }
};
