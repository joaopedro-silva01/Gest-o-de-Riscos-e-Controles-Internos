import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  BrainCircuit, 
  Database, 
  Bell, 
  ChevronDown,
  Filter,
  Download,
  Trash2,
  Plus,
  Circle,
  X,
  Save,
  CheckCircle2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { MOCK_RISKS, MOCK_DOCUMENTS } from './constants';
import { generateStrategicAnalysis } from './services/geminiService';
import { DocumentItem, RiskItem, UnitType, RiskLevel, DocumentType } from './types';

// Helper for date formatting
const formatDateBR = (dateString: string) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

// Colors for charts
const COLORS = ['#94a3b8', '#3b82f6', '#1e3a8a']; // Gray, Blue, Dark Blue

const App: React.FC = () => {
  // Data State (Initialized from LocalStorage if available)
  const [risks, setRisks] = useState<RiskItem[]>(() => {
    const savedRisks = localStorage.getItem('cicllos_risks');
    return savedRisks ? JSON.parse(savedRisks) : MOCK_RISKS;
  });

  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    const savedDocs = localStorage.getItem('cicllos_docs');
    return savedDocs ? JSON.parse(savedDocs) : MOCK_DOCUMENTS;
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'manage' | 'ai'>('dashboard');
  const [selectedUnit, setSelectedUnit] = useState<string>('Consolidado');
  
  // Data Management Sub-tab State
  const [manageTab, setManageTab] = useState<'risks' | 'documents'>('risks');

  // Filter State
  const [riskFilter, setRiskFilter] = useState('Todos');
  const [docStatusFilter, setDocStatusFilter] = useState('Todos');

  // AI State
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Saving State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // --- Logic for Automatic Risk Calculation ---

  // Formula: Calculates Impact Label based on Score (1-5)
  const getImpactLabel = (score: number) => {
    const rounded = Math.round(score);
    if (rounded === 1) return "Insignificante";
    if (rounded === 2) return "Pequeno";
    if (rounded === 3) return "Moderado";
    if (rounded === 4) return "Grande";
    if (rounded === 5) return "Catastrófico";
    return "-";
  };

  // Formula: Calculates Risk Level Code based on Matrix Score (Prob * Impact)
  const getRiskLevelCode = (prob: number, impact: number) => {
    const score = prob * Math.round(impact);
    
    // Adapted ranges to include RG (Grande) as requested
    if (score < 4) return { code: "RP", label: "Pequeno" };    // 1-3
    if (score < 8) return { code: "RM", label: "Moderado" };   // 4-7
    if (score < 15) return { code: "RA", label: "Alto" };      // 8-14
    if (score < 20) return { code: "RG", label: "Grande" };    // 15-19 (New Tier)
    return { code: "RC", label: "Crítico" };                   // 20-25
  };

  // Function to update a risk item and recalculate derived fields
  const updateRisk = (id: string, field: keyof RiskItem, value: any) => {
    setRisks(prevRisks => prevRisks.map(r => {
      if (r.id !== id) return r;

      const updatedRisk = { ...r, [field]: value };

      // If any factor or probability changes, recalculate Impact and Level
      if (['factorManagement', 'factorRegulation', 'factorFunctionality', 'factorLGPD', 'factorCustomer', 'probability'].includes(field)) {
        
        // Calculate Average Impact
        const factors = [
          Number(updatedRisk.factorManagement),
          Number(updatedRisk.factorRegulation),
          Number(updatedRisk.factorFunctionality),
          Number(updatedRisk.factorLGPD),
          Number(updatedRisk.factorCustomer)
        ];
        
        const sum = factors.reduce((a, b) => a + b, 0);
        const avgImpact = sum / 5; // Keep decimal for precision if needed, but usually we round for matrix
        updatedRisk.impact = avgImpact; // Store raw average

        // Calculate Level
        const levelData = getRiskLevelCode(Number(updatedRisk.probability), avgImpact);
        
        // Map back to RiskLevel enum for compatibility with types
        updatedRisk.level = levelData.label as RiskLevel; 
      }

      return updatedRisk;
    }));
    setSaveStatus('idle'); // Reset save status on change
  };

  const addRiskRow = () => {
    const newId = `new-${Date.now()}`;
    const newRisk: RiskItem = {
      id: newId,
      code: 'NOVO-00',
      title: 'Novo Risco',
      category: 'Operacional',
      unit: UnitType.SEGURADORA,
      factorManagement: 1,
      factorRegulation: 1,
      factorFunctionality: 1,
      factorLGPD: 1,
      factorCustomer: 1,
      probability: 1,
      impact: 1,
      level: RiskLevel.LOW,
      owner: 'Responsável'
    };
    setRisks([...risks, newRisk]);
    setSaveStatus('idle');
  };

  const deleteRisk = (id: string) => {
    setRisks(risks.filter(r => r.id !== id));
    setSaveStatus('idle');
  };

  // --- Logic for Documents ---

  const updateDocument = (id: string, field: keyof DocumentItem, value: any) => {
    setDocuments(prevDocs => prevDocs.map(d => 
      d.id === id ? { ...d, [field]: value } : d
    ));
    setSaveStatus('idle');
  };

  const addDocumentRow = () => {
    const newDoc: DocumentItem = {
      id: `new-doc-${Date.now()}`,
      title: 'Novo Documento',
      type: DocumentType.POLITICA,
      unit: UnitType.SEGURADORA,
      status: 'Draft',
      lastUpdated: new Date().toISOString().split('T')[0],
      description: ''
    };
    setDocuments([...documents, newDoc]);
    setSaveStatus('idle');
  };

  const deleteDocument = (id: string) => {
    setDocuments(documents.filter(d => d.id !== id));
    setSaveStatus('idle');
  };

  // --- Persistence Logic ---
  const handleSaveData = () => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('cicllos_risks', JSON.stringify(risks));
      localStorage.setItem('cicllos_docs', JSON.stringify(documents));
      
      // Simulate network delay for UX
      setTimeout(() => {
        setSaveStatus('saved');
        // Reset back to idle after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
      }, 600);
    } catch (e) {
      console.error("Failed to save to local storage", e);
      setSaveStatus('idle');
      alert("Erro ao salvar dados. Verifique o armazenamento do navegador.");
    }
  };


  // --- Derived Data for Views ---
  const getUnitFilter = () => {
    if (selectedUnit === 'Consolidado') return 'All';
    if (selectedUnit === 'Seguradora') return UnitType.SEGURADORA;
    return UnitType.CICLOS_PAY;
  };

  const filteredRisks = risks.filter(risk => {
    const unitMatch = selectedUnit === 'Consolidado' || risk.unit === selectedUnit;
    const levelMatch = riskFilter === 'Todos' || risk.level === riskFilter;
    return unitMatch && levelMatch;
  });

  const filteredDocs = documents.filter(doc => {
    const unitMatch = selectedUnit === 'Consolidado' || doc.unit === selectedUnit;
    const statusMatch = docStatusFilter === 'Todos' || 
      (docStatusFilter === 'Publicado' && doc.status === 'Published') ||
      (docStatusFilter === 'Em Revisão' && doc.status === 'Review') ||
      (docStatusFilter === 'Rascunho' && doc.status === 'Draft');
    return unitMatch && statusMatch;
  });

  // Calculate Dashboard Stats
  const criticalRisksCount = filteredRisks.filter(r => r.level === 'Crítico' || r.level === 'Alto' || r.level === 'Grande').length;
  const activePoliciesCount = filteredDocs.filter(d => d.type === DocumentType.POLITICA && d.status === 'Published').length;
  const operationalNormsCount = filteredDocs.filter(d => d.type === DocumentType.NORMA).length;
  const manualsCount = filteredDocs.filter(d => d.type === DocumentType.MANUAL).length;

  const docDistribution = [
    { name: 'Manuais', value: manualsCount },
    { name: 'Normas', value: operationalNormsCount },
    { name: 'Políticas', value: activePoliciesCount },
  ];

  const risksByCategory = [
    { name: 'Operacional', value: filteredRisks.filter(r => r.category === 'Operacional').length },
    { name: 'Legal / Regulatório', value: filteredRisks.filter(r => r.category.includes('Legal') || r.category.includes('Regulatório')).length },
    { name: 'Tecnológico', value: filteredRisks.filter(r => r.category === 'Tecnológico').length },
    { name: 'Financeiro', value: filteredRisks.filter(r => r.category === 'Financeiro').length },
    { name: 'Regulatório', value: filteredRisks.filter(r => r.category === 'Regulatório').length },
  ].filter(item => item.value > 0);

  // Gemini Handler
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Use current state (risks and documents) instead of MOCKs
      const result = await generateStrategicAnalysis(risks, documents, getUnitFilter());
      setAnalysisResult(result);
    } catch (error) {
      console.error(error);
      setAnalysisResult("Erro ao gerar análise. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper for Risk Matrix Cell Color - Updated to specific image hex colors
  const getMatrixCellColor = (p: number, i: number) => {
    const score = p * i;
    // Using exact colors: Green #92D050, Yellow #FFC000, Orange #F79646, Red #C00000
    if (score >= 15) return 'bg-[#C00000]'; // Red (Covers both Grande and Crítico)
    if (score >= 8) return 'bg-[#F79646]';  // Orange
    if (score >= 4) return 'bg-[#FFC000]';  // Yellow
    return 'bg-[#92D050]';                  // Green
  };

  const renderMatrixCell = (p: number, i: number) => {
    const risksInCell = filteredRisks.filter(r => Math.round(r.probability) === p && Math.round(r.impact) === i);
    return (
      <div className={`h-full w-full border border-slate-300 ${getMatrixCellColor(p, i)} relative flex items-center justify-center`}>
        {risksInCell.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center p-1">
            {risksInCell.map(r => (
              <span key={r.id} className="text-[10px] font-bold text-slate-900 bg-white/60 px-1 rounded shadow-sm cursor-help" title={`${r.title} (${r.unit})`}>
                {r.code}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // --- Render Views ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Painel Estratégico de Riscos e Complience</h2>
          <p className="text-slate-500 text-sm">Visualizando dados para: <span className="font-semibold text-blue-700">{selectedUnit === 'Consolidado' ? 'Visão Consolidada' : selectedUnit}</span></p>
        </div>
        
        {/* Save Button for Dashboard */}
        <div>
           <button 
             onClick={handleSaveData}
             className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all ${
               saveStatus === 'saved' 
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                : 'bg-blue-900 text-white hover:bg-blue-800'
             }`}
           >
             {saveStatus === 'saved' ? (
               <>
                 <CheckCircle2 className="w-4 h-4 mr-2" />
                 Alterações Salvas
               </>
             ) : (
               <>
                 <Save className="w-4 h-4 mr-2" />
                 {saveStatus === 'saving' ? 'Salvando...' : 'Salvar Alterações'}
               </>
             )}
           </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center text-slate-500 mr-2 border-r border-slate-200 pr-4">
          <Filter className="w-4 h-4 mr-2" />
          <span className="font-medium text-sm">Filtros</span>
        </div>
        
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Nível de Risco</label>
          <select 
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 min-w-[160px]"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option>Todos</option>
            <option>Pequeno</option>
            <option>Moderado</option>
            <option>Alto</option>
            <option>Grande</option>
            <option>Crítico</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Status Documento</label>
          <select 
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 min-w-[160px]"
            value={docStatusFilter}
            onChange={(e) => setDocStatusFilter(e.target.value)}
          >
            <option>Todos</option>
            <option>Publicado</option>
            <option>Em Revisão</option>
            <option>Rascunho</option>
          </select>
        </div>

        <div className="ml-auto">
           <button 
             onClick={() => {setRiskFilter('Todos'); setDocStatusFilter('Todos');}}
             className="text-slate-400 hover:text-slate-600 text-xs flex items-center"
           >
             <X className="w-3 h-3 mr-1" /> Limpar
           </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Riscos Críticos/Altos</h3>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-red-600">{criticalRisksCount}</span>
            <span className="ml-2 text-xs text-slate-400">Filtrado</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Políticas Vigentes</h3>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-slate-800">{activePoliciesCount}</span>
            <span className="ml-2 text-xs text-slate-400">Diretrizes</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Normas Operacionais</h3>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-slate-800">{operationalNormsCount}</span>
            <span className="ml-2 text-xs text-slate-400">Regras</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Manuais Técnicos</h3>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-slate-800">{manualsCount}</span>
            <span className="ml-2 text-xs text-slate-400">Documentação</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matrix - 2 Cols */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center">
            <div className="w-3 h-3 bg-blue-900 rounded-sm mr-2"></div>
            Matriz de Risco (Códigos)
          </h3>
          
          <div className="flex flex-col h-[350px]">
            {/* Upper Area: Labels + Matrix Grid */}
            <div className="flex flex-1 min-h-0">
              
              {/* Col 1: Title Y */}
              <div className="flex items-center justify-center w-8 shrink-0">
                <span className="text-xs font-bold text-slate-400 -rotate-90 whitespace-nowrap">IMPACTO</span>
              </div>
              
              {/* Col 2: Y-Axis Labels - Using grid to match matrix row height exactly */}
              <div className="grid grid-rows-5 gap-0.5 w-24 shrink-0 pr-3">
                 <div className="flex items-center justify-end text-xs text-right text-slate-500">Catastrófico 5</div>
                 <div className="flex items-center justify-end text-xs text-right text-slate-500">Grande 4</div>
                 <div className="flex items-center justify-end text-xs text-right text-slate-500">Moderado 3</div>
                 <div className="flex items-center justify-end text-xs text-right text-slate-500">Pequeno 2</div>
                 <div className="flex items-center justify-end text-xs text-right text-slate-500">Insignificante 1</div>
              </div>
              
              {/* Col 3: The Matrix Grid */}
              <div className="flex-1 grid grid-rows-5 gap-0.5">
                 {[5, 4, 3, 2, 1].map((impact) => (
                    <div key={impact} className="grid grid-cols-5 gap-0.5">
                      {[1, 2, 3, 4, 5].map((prob) => (
                        <div key={`${prob}-${impact}`} className="w-full h-full">
                           {renderMatrixCell(prob, impact)}
                        </div>
                      ))}
                    </div>
                 ))}
              </div>
            </div>

            {/* Bottom Area: X-Axis Labels */}
            <div className="flex mt-2">
               {/* Spacer for Y-Title and Y-Labels */}
               <div className="w-[calc(2rem+6rem+0.75rem)] shrink-0"></div> 
               
               {/* X-Axis Labels */}
               <div className="flex-1">
                  <div className="flex justify-between px-1 text-xs text-center text-slate-500">
                    <span className="w-1/5">Muito Baixa<br/>1</span>
                    <span className="w-1/5">Baixa<br/>2</span>
                    <span className="w-1/5">Possível<br/>3</span>
                    <span className="w-1/5">Alta<br/>4</span>
                    <span className="w-1/5">Muito Alta<br/>5</span>
                  </div>
                  <div className="text-center mt-2">
                     <span className="text-xs font-bold text-slate-400 uppercase">PROBABILIDADE</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Donut Chart - 1 Col */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-700 mb-4">Distribuição Documental</h3>
          <div className="flex-1 flex items-center justify-center h-[280px]">
             {/* Chart Side */}
             <div className="w-[60%] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={docDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {docDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
             </div>
             
             {/* Legend Side (Right) */}
             <div className="w-[40%] flex flex-col justify-center space-y-3">
               {docDistribution.map((entry, index) => (
                 <div key={index} className="flex items-center">
                    <div className="w-3 h-3 rounded-sm mr-2 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <div className="flex flex-col">
                       <span className="text-xs text-slate-600 font-medium">{entry.name}</span>
                       <span className="text-[10px] text-slate-400 font-bold">{entry.value} docs</span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Legend Table - Standardized Card */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
            <h3 className="font-bold text-slate-700 mb-4">Legenda do Risco</h3>
            <div className="flex-1 flex items-center">
              <table className="w-full text-xs">
                 <thead>
                    <tr className="border-b border-slate-200">
                       <th className="text-left py-2 text-slate-500 uppercase tracking-wide">Níveis</th>
                       <th className="text-right py-2 text-slate-500 uppercase tracking-wide">Pontuação</th>
                    </tr>
                 </thead>
                 <tbody>
                    <tr className="border-b border-slate-100">
                       <td className="py-3 flex items-center">
                          <div className="w-5 h-5 mr-3 border border-slate-200 rounded-sm" style={{ backgroundColor: '#92D050' }}></div>
                          <span className="text-slate-700 font-medium">RP - Risco Pequeno</span>
                       </td>
                       <td className="text-right text-slate-500">1 - 3</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                       <td className="py-3 flex items-center">
                          <div className="w-5 h-5 mr-3 border border-slate-200 rounded-sm" style={{ backgroundColor: '#FFC000' }}></div>
                          <span className="text-slate-700 font-medium">RM - Risco Moderado</span>
                       </td>
                       <td className="text-right text-slate-500">4 - 7</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                       <td className="py-3 flex items-center">
                          <div className="w-5 h-5 mr-3 border border-slate-200 rounded-sm" style={{ backgroundColor: '#F79646' }}></div>
                          <span className="text-slate-700 font-medium">RA - Risco Alto</span>
                       </td>
                       <td className="text-right text-slate-500">8 - 14</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                       <td className="py-3 flex items-center">
                          <div className="w-5 h-5 mr-3 border border-slate-200 rounded-sm" style={{ backgroundColor: '#C00000' }}></div>
                          <span className="text-slate-700 font-medium">RG - Risco Grande</span>
                       </td>
                       <td className="text-right text-slate-500">15 - 19</td>
                    </tr>
                    <tr>
                       <td className="py-3 flex items-center">
                          <div className="w-5 h-5 mr-3 border border-slate-200 rounded-sm" style={{ backgroundColor: '#C00000' }}></div>
                          <span className="text-slate-700 font-medium">RC - Risco Crítico</span>
                       </td>
                       <td className="text-right text-slate-500">20 - 25</td>
                    </tr>
                 </tbody>
              </table>
            </div>
         </div>

         {/* Bar Chart */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[300px]">
            <h3 className="font-bold text-slate-700 mb-4">Riscos por Categoria</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart layout="vertical" data={risksByCategory} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#64748b'}} />
                <Tooltip />
                <Bar dataKey="value" fill="#1e3a8a" barSize={15} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
         </div>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Biblioteca Normativa</h2>
          <p className="text-slate-500 text-sm">Visualizando dados para: <span className="font-semibold text-blue-700">{selectedUnit === 'Consolidado' ? 'Visão Consolidada' : selectedUnit}</span></p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
           <h3 className="font-bold text-slate-700 text-sm">Inventário Normativo</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-white border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Título</th>
              <th className="px-6 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Unidade</th>
              <th className="px-6 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-bold text-xs text-slate-400 uppercase tracking-wider">Última Atualização</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDocs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{doc.title}</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                    {doc.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">{doc.unit}</td>
                <td className="px-6 py-4">
                  <span className={`flex items-center w-fit px-2 py-1 rounded-md text-xs font-medium border ${
                    doc.status === 'Published' ? 'border-emerald-200 text-emerald-700' :
                    doc.status === 'Draft' ? 'border-slate-200 text-slate-600' :
                    'border-amber-200 text-amber-700'
                  }`}>
                    <Circle className={`w-2 h-2 mr-1.5 fill-current ${
                       doc.status === 'Published' ? 'text-emerald-500' :
                       doc.status === 'Draft' ? 'text-slate-400' :
                       'text-amber-500'
                    }`} />
                    {doc.status === 'Published' ? 'Publicado' : doc.status === 'Draft' ? 'Rascunho' : 'Revisão'}
                  </span>
                </td>
                <td className="px-6 py-4 text-blue-500 font-medium text-xs">{formatDateBR(doc.lastUpdated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderManageData = () => (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Dados</h2>
        <p className="text-slate-500 text-sm">Visualizando dados para: <span className="font-semibold text-blue-700">{selectedUnit === 'Consolidado' ? 'Visão Consolidada' : selectedUnit}</span></p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button 
            onClick={() => setManageTab('risks')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${manageTab === 'risks' ? 'bg-blue-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
          >
            Planilha de Riscos
          </button>
          <button 
            onClick={() => setManageTab('documents')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${manageTab === 'documents' ? 'bg-blue-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
          >
            Planilha de Documentos
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-700 text-sm">
              {manageTab === 'risks' ? 'Editar Riscos (Automático)' : 'Editar Políticas e Normas'}
            </h3>
            <button 
              onClick={manageTab === 'risks' ? addRiskRow : addDocumentRow}
              className="flex items-center px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-3 h-3 mr-1" /> Adicionar Linha
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/50 border-b border-slate-200">
                <tr>
                  {manageTab === 'risks' ? (
                    <>
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider min-w-[150px]">Título do Risco</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider min-w-[120px]">Categoria</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider min-w-[100px]">Unidade</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider w-16 text-center">Prob.</th>
                      
                      {/* Fatores de Cálculo */}
                      <th className="px-2 py-3 font-bold text-[10px] text-blue-400 uppercase tracking-wider w-16 text-center bg-blue-50/30">Gestão</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-blue-400 uppercase tracking-wider w-16 text-center bg-blue-50/30">Regul.</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-blue-400 uppercase tracking-wider w-16 text-center bg-blue-50/30">Func.</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-blue-400 uppercase tracking-wider w-16 text-center bg-blue-50/30">LGPD</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-blue-400 uppercase tracking-wider w-16 text-center bg-blue-50/30">Client.</th>
                      
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-700 uppercase tracking-wider min-w-[100px] bg-slate-100">Impacto (Calc)</th>
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-700 uppercase tracking-wider min-w-[80px] bg-slate-100">Nível (Auto)</th>
                      <th className="px-2 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider min-w-[80px]">Código</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider min-w-[200px]">Título do Documento</th>
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider">Unidade</th>
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider">Data Atualização</th>
                    </>
                  )}
                  <th className="px-4 py-3 font-bold text-[10px] text-slate-400 uppercase tracking-wider text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manageTab === 'risks' ? (
                  filteredRisks.map((risk) => (
                    <tr key={risk.id} className="hover:bg-slate-50 group">
                      <td className="px-2 py-2">
                        <input 
                          type="text" 
                          value={risk.title}
                          onChange={(e) => updateRisk(risk.id, 'title', e.target.value)}
                          className="w-full text-xs border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2">
                         <select 
                           value={risk.category}
                           onChange={(e) => updateRisk(risk.id, 'category', e.target.value)}
                           className="w-full text-xs border-slate-200 rounded px-1 py-1"
                         >
                           <option>Operacional</option>
                           <option>Legal / Regulatório</option>
                           <option>Tecnológico</option>
                           <option>Financeiro</option>
                           <option>Regulatório</option>
                         </select>
                      </td>
                      <td className="px-2 py-2">
                        <select 
                           value={risk.unit}
                           onChange={(e) => updateRisk(risk.id, 'unit', e.target.value)}
                           className="w-full text-xs border-slate-200 rounded px-1 py-1"
                         >
                           <option value={UnitType.SEGURADORA}>Seguradora</option>
                           <option value={UnitType.CICLOS_PAY}>Ciclos Pay</option>
                         </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input 
                          type="number" min="1" max="5"
                          value={risk.probability}
                          onChange={(e) => updateRisk(risk.id, 'probability', parseInt(e.target.value))}
                          className="w-12 text-center text-xs border-slate-200 rounded px-1 py-1 font-bold"
                        />
                      </td>

                      {/* Factors Inputs */}
                      {['factorManagement', 'factorRegulation', 'factorFunctionality', 'factorLGPD', 'factorCustomer'].map((factor) => (
                         <td key={factor} className="px-2 py-2 text-center bg-blue-50/10">
                           <input 
                             type="number" min="1" max="5"
                             value={risk[factor as keyof RiskItem] as number}
                             onChange={(e) => updateRisk(risk.id, factor as keyof RiskItem, parseInt(e.target.value))}
                             className="w-10 text-center text-[10px] border-blue-100 rounded px-1 py-1 focus:ring-blue-500 text-slate-500"
                           />
                         </td>
                      ))}

                      {/* Calculated Columns */}
                      <td className="px-4 py-2 bg-slate-50">
                        <div className="flex flex-col">
                           <span className="text-xs font-bold text-slate-700">{getImpactLabel(risk.impact)}</span>
                           <span className="text-[10px] text-slate-400">Média: {risk.impact.toFixed(1)}</span>
                        </div>
                      </td>
                      
                      <td className="px-4 py-2 bg-slate-50">
                         {(() => {
                            const levelData = getRiskLevelCode(risk.probability, risk.impact);
                            return (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                levelData.code === 'RC' || levelData.code === 'RG' ? 'bg-[#C00000] text-white border-transparent' :
                                levelData.code === 'RA' ? 'bg-[#F79646] text-white border-transparent' :
                                levelData.code === 'RM' ? 'bg-[#FFC000] text-slate-900 border-transparent' :
                                'bg-[#92D050] text-slate-900 border-transparent'
                              }`}>
                                {levelData.code} - {levelData.label}
                              </span>
                            );
                         })()}
                      </td>

                      <td className="px-2 py-2">
                        <input 
                          type="text" 
                          value={risk.code}
                          onChange={(e) => updateRisk(risk.id, 'code', e.target.value)}
                          className="w-full text-xs border-slate-200 rounded px-2 py-1 font-mono"
                        />
                      </td>
                      
                      <td className="px-4 py-3 text-center flex justify-center gap-3">
                        <button 
                          onClick={() => deleteRisk(risk.id)}
                          className="text-red-300 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 group">
                      <td className="px-2 py-2">
                         <input 
                          type="text" 
                          value={doc.title}
                          onChange={(e) => updateDocument(doc.id, 'title', e.target.value)}
                          className="w-full text-xs border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                         <select 
                           value={doc.type}
                           onChange={(e) => updateDocument(doc.id, 'type', e.target.value)}
                           className="w-full text-xs border-slate-200 rounded px-1 py-1"
                         >
                           <option value={DocumentType.POLITICA}>Política</option>
                           <option value={DocumentType.NORMA}>Norma</option>
                           <option value={DocumentType.MANUAL}>Manual</option>
                         </select>
                      </td>
                      <td className="px-2 py-2">
                         <select 
                           value={doc.unit}
                           onChange={(e) => updateDocument(doc.id, 'unit', e.target.value)}
                           className="w-full text-xs border-slate-200 rounded px-1 py-1"
                         >
                           <option value={UnitType.SEGURADORA}>Seguradora</option>
                           <option value={UnitType.CICLOS_PAY}>Ciclos Pay</option>
                         </select>
                      </td>
                      <td className="px-2 py-2">
                         <select 
                           value={doc.status}
                           onChange={(e) => updateDocument(doc.id, 'status', e.target.value)}
                           className="w-full text-xs border-slate-200 rounded px-1 py-1"
                         >
                           <option value="Published">Publicado</option>
                           <option value="Review">Revisão</option>
                           <option value="Draft">Rascunho</option>
                         </select>
                      </td>
                      <td className="px-2 py-2">
                         <input 
                          type="date" 
                          value={doc.lastUpdated}
                          onChange={(e) => updateDocument(doc.id, 'lastUpdated', e.target.value)}
                          className="w-full text-xs border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-3 text-center flex justify-center gap-3">
                        <button 
                          onClick={() => deleteDocument(doc.id)}
                          className="text-red-300 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAIAnalysis = () => (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Assistente Estratégico</h2>
        <p className="text-slate-500 text-sm">Visualizando dados para: <span className="font-semibold text-blue-700">{selectedUnit === 'Consolidado' ? 'Visão Consolidada' : selectedUnit}</span></p>
      </div>

      <div className="bg-[#1e40af] rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
        {/* Decorative background circle */}
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-2 flex items-center">
              <BrainCircuit className="w-6 h-6 mr-3" />
              Conselheiro Estratégico AI
            </h2>
            <p className="text-blue-100 text-sm leading-relaxed">
              Utilize nossa inteligência artificial para analisar a correlação entre os riscos 
              identificados e a estrutura normativa da <span className="font-bold">{selectedUnit === 'Consolidado' ? 'organização completa' : selectedUnit}</span>.
            </p>
          </div>
          <div>
            <button 
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="bg-white text-blue-900 px-6 py-3 rounded-lg font-bold text-sm shadow-md hover:bg-blue-50 transition-colors disabled:opacity-80 flex items-center"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-900 mr-2"></div>
                  Analisando...
                </>
              ) : (
                'Gerar Análise Estratégica'
              )}
            </button>
          </div>
        </div>
      </div>

      {analysisResult ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 animate-fade-in-up">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800">Resultado da Análise</h3>
          </div>
          <div className="prose prose-slate prose-sm max-w-none text-slate-600">
             {analysisResult.split('\n').map((line, i) => {
               if (line.startsWith('###')) return <h3 key={i} className="text-base font-bold text-slate-800 mt-6 mb-2">{line.replace('###', '')}</h3>;
               if (line.startsWith('**')) return <p key={i} className="font-bold mb-2 text-slate-800">{line.replace(/\*\*/g, '')}</p>;
               if (line.startsWith('-')) return <li key={i} className="ml-4 mb-1">{line.replace('-', '')}</li>;
               return <p key={i} className="mb-3 leading-relaxed">{line}</p>;
             })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center h-64 flex flex-col justify-center items-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4">
            <BrainCircuit className="w-6 h-6 text-slate-300" />
          </div>
          <h3 className="font-bold text-slate-700">Aguardando solicitação</h3>
          <p className="text-slate-400 text-sm mt-1">Clique no botão acima para gerar insights baseados nos dados atuais.</p>
        </div>
      )}
    </div>
  );

  // --- Main Layout ---
  return (
    <div className="flex h-screen bg-[#f3f4f6] font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
        {/* Logo Section */}
        <div className="p-6 pb-2">
          <div className="flex items-center space-x-2 mb-1">
             <div className="text-blue-900">
               <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="8" strokeOpacity="0.2"/>
                 <path d="M20 5C11.7157 5 5 11.7157 5 20" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/>
               </svg>
             </div>
             <div>
               <h1 className="text-2xl font-bold text-blue-900 tracking-tight leading-none">Cicllos</h1>
             </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase ml-1 mb-6">Tecnologia para a vida</p>
          
          <div className="bg-blue-50 text-blue-700 py-2 px-4 rounded font-bold text-xs text-center uppercase tracking-wide mb-6">
            Gestão de Riscos
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-r-full border-l-4 transition-all ${
              activeTab === 'dashboard' 
                ? 'border-blue-900 bg-blue-50 text-blue-900' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Visão Geral</span>
          </button>

          <button 
            onClick={() => setActiveTab('documents')}
            className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-r-full border-l-4 transition-all ${
              activeTab === 'documents' 
                ? 'border-blue-900 bg-blue-50 text-blue-900' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Políticas e Normas</span>
          </button>

          <button 
            onClick={() => setActiveTab('manage')}
            className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-r-full border-l-4 transition-all ${
              activeTab === 'manage' 
                ? 'border-blue-900 bg-blue-50 text-blue-900' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Database className="w-5 h-5" />
            <span>Gerenciar Dados</span>
          </button>

          <button 
            onClick={() => setActiveTab('ai')}
            className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-r-full border-l-4 transition-all ${
              activeTab === 'ai' 
                ? 'border-blue-900 bg-blue-50 text-blue-900' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <BrainCircuit className="w-5 h-5" />
            <span>Análise IA</span>
          </button>
        </nav>

        {/* Bottom Section */}
        <div className="p-6 mt-auto">
           <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Ambiente</p>
              <div className="flex items-center justify-between">
                 <span className="text-sm font-bold text-slate-700">Corporativo</span>
                 <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Online</span>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
          {/* Breadcrumbs */}
          <div className="flex items-center text-sm text-slate-500">
             <span className="font-medium text-slate-400">Ciclos</span>
             <span className="mx-2 text-slate-300">/</span>
             <span className="font-bold text-blue-900">
               {activeTab === 'dashboard' ? 'Dashboard' : 
                activeTab === 'documents' ? 'Documentos' : 
                activeTab === 'manage' ? 'Gerenciamento' : 'Inteligência'}
             </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
             <button className="flex items-center px-4 py-1.5 bg-blue-900 text-white rounded text-xs font-bold hover:bg-blue-800 transition-colors">
               <Download className="w-3 h-3 mr-2" />
               Exportar PDF
             </button>

             {/* Unit Selector Toggle */}
             <div className="flex bg-slate-100 rounded p-1">
               {['Consolidado', 'Seguradora', 'Ciclos Pay'].map((unit) => (
                 <button
                   key={unit}
                   onClick={() => setSelectedUnit(unit)}
                   className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                     selectedUnit === unit 
                       ? 'bg-white text-blue-900 shadow-sm' 
                       : 'text-slate-400 hover:text-slate-600'
                   }`}
                 >
                   {unit}
                 </button>
               ))}
             </div>

             <div className="w-px h-6 bg-slate-200 mx-2"></div>

             <button className="relative text-slate-400 hover:text-slate-600">
               <Bell className="w-5 h-5" />
               <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto p-8">
           <div className="max-w-[1400px] mx-auto">
             {activeTab === 'dashboard' && renderDashboard()}
             {activeTab === 'documents' && renderDocuments()}
             {activeTab === 'manage' && renderManageData()}
             {activeTab === 'ai' && renderAIAnalysis()}
           </div>
        </main>
      </div>
    </div>
  );
};

export default App;