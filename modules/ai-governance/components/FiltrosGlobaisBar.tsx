/**
 * Barra de filtros globais (seção 17). Os filtros ficam no estado do módulo e
 * atualizam indicadores, gráficos e listas de todas as páginas.
 */
import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { CATEGORIAS_HOMOLOGACAO, CATEGORIA_LABEL, NIVEIS_RISCO, NIVEL_RISCO_LABEL, STATUS_USO, TIPOS_DADO, TIPO_DADO_LABEL } from '../domain/catalogs';
import type { FiltrosGlobais } from '../domain/types';
import { FILTROS_VAZIOS, filtrosAtivos } from '../services/metrics';
import { useGovernanca } from '../state/GovernanceContext';
import { cx } from './ui';

const selCls = 'w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gov-sky/40';

export const FiltrosGlobaisBar: React.FC = () => {
  const { filtros, setFiltros, db, usuariosEscopo, registros } = useGovernanca();
  const [aberto, setAberto] = useState(false);
  const n = filtrosAtivos(filtros);
  const set = (k: keyof FiltrosGlobais) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setFiltros({ ...filtros, [k]: e.target.value });

  // Opções limitadas ao escopo do perfil (um gestor não vê colaboradores de outras áreas).
  const deptos = db.departamentos.filter(d => usuariosEscopo.some(u => u.departamentoId === d.id));
  const empresas = db.empresas.filter(e => usuariosEscopo.some(u => u.empresaId === e.id));
  const responsaveis = db.usuarios.filter(u => registros.some(r => r.responsavelProcessoId === u.id));

  const campo = (rotulo: string, k: keyof FiltrosGlobais, opcoes: [string, string][]) => (
    <label className="block min-w-0">
      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{rotulo}</span>
      <select className={selCls} value={filtros[k]} onChange={set(k)}>
        <option value="">Todos</option>
        {opcoes.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button onClick={() => setAberto(a => !a)} className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-gov-blue" aria-expanded={aberto}>
          <Filter className="w-4 h-4" />
          Filtros globais
          {n > 0 && <span className="bg-gov-navy text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{n}</span>}
          <ChevronDown className={cx('w-4 h-4 transition-transform', aberto && 'rotate-180')} />
        </button>
        <span className="hidden sm:inline text-xs text-slate-500">Atualizam indicadores, gráficos e listas.</span>
        {n > 0 && (
          <button onClick={() => setFiltros(FILTROS_VAZIOS)} className="ml-auto text-xs text-slate-500 hover:text-slate-800 flex items-center">
            <X className="w-3 h-3 mr-1" /> Limpar
          </button>
        )}
      </div>
      {aberto && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 px-4 pb-4 pt-1 border-t border-slate-100">
          {campo('Empresa', 'empresaId', empresas.map(e => [e.id, e.nome]))}
          {campo('Departamento', 'departamentoId', deptos.map(d => [d.id, d.nome]))}
          {campo('Colaborador', 'colaboradorId', usuariosEscopo.map(u => [u.id, u.nome]))}
          {campo('Ferramenta', 'ferramentaId', db.ferramentas.map(f => [f.id, f.nome]))}
          {campo('Homologação', 'homologacao', CATEGORIAS_HOMOLOGACAO.map(c => [c, CATEGORIA_LABEL[c]]))}
          {campo('Status', 'status', STATUS_USO.map(s => [s, s]))}
          {campo('Nível de risco', 'nivelRisco', NIVEIS_RISCO.map(nv => [nv, NIVEL_RISCO_LABEL[nv]]))}
          {campo('Tipo de dado', 'tipoDado', TIPOS_DADO.map(t => [t, TIPO_DADO_LABEL[t]]))}
          {campo('Responsável', 'responsavelId', responsaveis.map(u => [u.id, u.nome]))}
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Início a partir de</span>
            <input type="date" className={selCls} value={filtros.periodoInicio} onChange={set('periodoInicio')} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Início até</span>
            <input type="date" className={selCls} value={filtros.periodoFim} onChange={set('periodoFim')} />
          </label>
        </div>
      )}
    </div>
  );
};
