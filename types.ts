export enum UnitType {
  SEGURADORA = 'Seguradora',
  CICLOS_PAY = 'Ciclos Pay'
}

export enum DocumentType {
  POLITICA = 'Política',
  NORMA = 'Norma',
  MANUAL = 'Manual'
}

export enum RiskLevel {
  LOW = 'Pequeno',
  MEDIUM = 'Moderado',
  HIGH = 'Alto',
  LARGE = 'Grande',
  CRITICAL = 'Crítico'
}

export interface DocumentItem {
  id: string;
  title: string;
  type: DocumentType;
  unit: UnitType;
  status: 'Published' | 'Draft' | 'Review';
  lastUpdated: string;
  description: string;
}

export interface RiskItem {
  id: string;
  code: string; // Código de identificação visual na matriz (ex: R-001)
  title: string;
  category: string;
  
  // Fatores Estratégicos para Cálculo de Impacto
  factorManagement: number; // Esforço de Gestão
  factorRegulation: number; // Regulação
  factorFunctionality: number; // Funcionalidade
  factorLGPD: number; // LGPD e Segurança de Dados
  factorCustomer: number; // Carteira de Clientes e Experiência do Usuário
  
  probability: number; // 1-5 (Frequência)
  impact: number; // 1-5 (Calculado pela média dos fatores)
  level: RiskLevel;
  unit: UnitType;
  owner: string;
}

export interface DashboardStats {
  totalPolicies: number;
  totalNorms: number;
  totalManuals: number;
  avgRiskScore: number;
}