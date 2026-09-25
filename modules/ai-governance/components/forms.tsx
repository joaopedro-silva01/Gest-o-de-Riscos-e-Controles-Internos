/**
 * Utilitários de formulário compartilhados pelos cadastros do módulo.
 */
import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ID, Usuario } from '../domain/types';
import { Botao, inputCls } from './ui';

/**
 * Exclusão em dois cliques. Evita `confirm()` (bloqueado em alguns ambientes)
 * e deixa a confirmação visível na própria tela.
 */
export const BotaoExcluir: React.FC<{ onConfirmar: () => void; bloqueio?: string; rotulo?: string }> = ({ onConfirmar, bloqueio, rotulo = 'Excluir' }) => {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);
  if (bloqueio) {
    return <span className="text-[11px] text-slate-500 self-center" title={bloqueio}>Exclusão bloqueada: {bloqueio}</span>;
  }
  return armado ? (
    <Botao variante="perigo" tamanho="sm" icone={<Trash2 className="w-3.5 h-3.5" />} onClick={onConfirmar}>Confirmar exclusão</Botao>
  ) : (
    <Botao variante="fantasma" tamanho="sm" icone={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setArmado(true)}>{rotulo}</Botao>
  );
};

/** Lista de textos editada como "um item por linha". */
export const LinhasTextarea: React.FC<{ id: string; valor: string[]; onChange: (v: string[]) => void; placeholder?: string; linhas?: number }> = ({ id, valor, onChange, placeholder, linhas = 3 }) => {
  const [texto, setTexto] = useState(valor.join('\n'));
  return (
    <textarea
      id={id}
      className={inputCls}
      rows={linhas}
      placeholder={placeholder}
      value={texto}
      onChange={e => {
        setTexto(e.target.value);
        onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean));
      }}
    />
  );
};

export const SelectUsuario: React.FC<{ id: string; valor?: ID; onChange: (v: ID | undefined) => void; usuarios: Usuario[]; vazio?: string }> = ({ id, valor, onChange, usuarios, vazio = 'Sem responsável' }) => (
  <select id={id} className={inputCls} value={valor ?? ''} onChange={e => onChange(e.target.value || undefined)}>
    <option value="">{vazio}</option>
    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
  </select>
);

/** Lista de caixas de seleção para relacionamentos N:N (controles, ferramentas...). */
export const Multiselecao: React.FC<{ opcoes: { id: ID; rotulo: string; detalhe?: string }[]; valor: ID[]; onChange: (v: ID[]) => void; altura?: string }> = ({ opcoes, valor, onChange, altura = 'max-h-44' }) => (
  <div className={`grid gap-0.5 overflow-y-auto pr-1 rounded-lg border border-slate-200 p-2 ${altura}`}>
    {opcoes.map(o => (
      <label key={o.id} className="flex items-start gap-2 text-sm py-1">
        <input type="checkbox" className="mt-1 accent-[#1d4e89]" checked={valor.includes(o.id)} onChange={e => onChange(e.target.checked ? [...valor, o.id] : valor.filter(x => x !== o.id))} />
        <span>{o.rotulo}{o.detalhe && <span className="text-xs text-slate-500"> ({o.detalhe})</span>}</span>
      </label>
    ))}
  </div>
);

/** Estado de rascunho de um formulário de cadastro. */
export const useRascunho = <T,>(inicial: T | null) => {
  const [rascunho, setRascunho] = useState<T | null>(inicial);
  const set = <K extends keyof T>(k: K, v: T[K]) => setRascunho(r => (r ? { ...r, [k]: v } : r));
  return { rascunho, setRascunho, set };
};
