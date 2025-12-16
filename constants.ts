import { DocumentItem, DocumentType, RiskItem, RiskLevel, UnitType } from './types';

export const MOCK_DOCUMENTS: DocumentItem[] = [
  // Seguradora
  {
    id: '1',
    title: 'Política de Subscrição de Riscos',
    type: DocumentType.POLITICA,
    unit: UnitType.SEGURADORA,
    status: 'Published',
    lastUpdated: '2023-10-15',
    description: 'Diretrizes para aceitação de novos riscos de seguros.'
  },
  {
    id: '2',
    title: 'Manual de Sinistros',
    type: DocumentType.MANUAL,
    unit: UnitType.SEGURADORA,
    status: 'Published',
    lastUpdated: '2023-11-02',
    description: 'Procedimentos operacionais para regulação de sinistros.'
  },
  {
    id: '3',
    title: 'Norma de PLD/FT',
    type: DocumentType.NORMA,
    unit: UnitType.SEGURADORA,
    status: 'Review',
    lastUpdated: '2024-01-10',
    description: 'Prevenção à Lavagem de Dinheiro e Financiamento do Terrorismo.'
  },
  // Ciclos Pay
  {
    id: '4',
    title: 'Política de Segurança Cibernética',
    type: DocumentType.POLITICA,
    unit: UnitType.CICLOS_PAY,
    status: 'Published',
    lastUpdated: '2023-12-05',
    description: 'Diretrizes de proteção de dados e infraestrutura de pagamentos.'
  },
  {
    id: '5',
    title: 'Manual de Integração API',
    type: DocumentType.MANUAL,
    unit: UnitType.CICLOS_PAY,
    status: 'Published',
    lastUpdated: '2024-02-20',
    description: 'Guia técnico para parceiros integrarem ao gateway.'
  },
  {
    id: '6',
    title: 'Norma de Reconciliação Financeira',
    type: DocumentType.NORMA,
    unit: UnitType.CICLOS_PAY,
    status: 'Draft',
    lastUpdated: '2024-03-01',
    description: 'Regras para conciliação diária de transações.'
  },
  {
    id: '7',
    title: 'Política de Gestão de Liquidez',
    type: DocumentType.POLITICA,
    unit: UnitType.CICLOS_PAY,
    status: 'Published',
    lastUpdated: '2023-09-20',
    description: 'Controle de fluxo de caixa e reservas obrigatórias.'
  }
];

export const MOCK_RISKS: RiskItem[] = [
  {
    id: 'r1',
    code: 'OP-001',
    title: 'Fraude em Sinistros',
    category: 'Operacional',
    factorManagement: 5,
    factorRegulation: 4,
    factorFunctionality: 5,
    factorLGPD: 5,
    factorCustomer: 5,
    probability: 3,
    impact: 5, // Média arredondada (24/5 = 4.8 -> 5)
    level: RiskLevel.HIGH,
    unit: UnitType.SEGURADORA,
    owner: 'Equipe de Fraude'
  },
  {
    id: 'r2',
    code: 'LGPD-02',
    title: 'Vazamento de Dados LGPD',
    category: 'Legal / Regulatório',
    factorManagement: 5,
    factorRegulation: 5,
    factorFunctionality: 5,
    factorLGPD: 5,
    factorCustomer: 5,
    probability: 2,
    impact: 5,
    level: RiskLevel.CRITICAL,
    unit: UnitType.CICLOS_PAY,
    owner: 'DPO'
  },
  {
    id: 'r3',
    code: 'TEC-05',
    title: 'Falha no Gateway de Pagamento',
    category: 'Tecnológico',
    factorManagement: 4,
    factorRegulation: 3,
    factorFunctionality: 5,
    factorLGPD: 3,
    factorCustomer: 5,
    probability: 2,
    impact: 4, // (20/5 = 4)
    level: RiskLevel.HIGH,
    unit: UnitType.CICLOS_PAY,
    owner: 'CTO'
  },
  {
    id: 'r4',
    code: 'FIN-01',
    title: 'Inadimplência de Prêmios',
    category: 'Financeiro',
    factorManagement: 3,
    factorRegulation: 2,
    factorFunctionality: 2,
    factorLGPD: 1,
    factorCustomer: 2,
    probability: 4,
    impact: 2, // (10/5 = 2)
    level: RiskLevel.MEDIUM,
    unit: UnitType.SEGURADORA,
    owner: 'CFO'
  },
  {
    id: 'r5',
    code: 'REG-03',
    title: 'Alterações Regulatórias SUSEP',
    category: 'Regulatório',
    factorManagement: 4,
    factorRegulation: 5,
    factorFunctionality: 3,
    factorLGPD: 4,
    factorCustomer: 3,
    probability: 3,
    impact: 4, // (19/5 = 3.8 -> 4)
    level: RiskLevel.HIGH,
    unit: UnitType.SEGURADORA,
    owner: 'Compliance'
  }
];