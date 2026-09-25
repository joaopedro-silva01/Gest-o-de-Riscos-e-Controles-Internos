/**
 * Gráficos do módulo (Recharts). Regras aplicadas:
 * - série única usa uma só cor (COR_SERIE); cores só quando codificam algo (risco, homologação);
 * - valores rotulados diretamente nas barras (cor nunca é a única pista);
 * - tooltip ao passar o mouse; cada gráfico tem visão em tabela (acessibilidade).
 */
import React, { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { COR_SERIE } from '../domain/catalogs';
import type { Serie } from '../services/metrics';
import { Card, Vazio } from './ui';

const eixo = { fontSize: 11, fill: '#475569' };
const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(15,23,42,.08)' };

export const ChartCard: React.FC<{ titulo: string; subtitulo?: string; dados: { nome: string; valor: number }[]; children: React.ReactNode; className?: string }> = ({ titulo, subtitulo, dados, children, className }) => {
  const [tabela, setTabela] = useState(false);
  const total = dados.reduce((s, d) => s + d.valor, 0);
  return (
    <Card
      titulo={titulo}
      subtitulo={subtitulo}
      className={className}
      acoes={
        <button
          onClick={() => setTabela(t => !t)}
          className="p-1 rounded text-slate-400 hover:text-gov-blue hover:bg-slate-100"
          title={tabela ? 'Ver gráfico' : 'Ver tabela'}
          aria-label={tabela ? 'Ver gráfico' : 'Ver tabela'}
        >
          {tabela ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
        </button>
      }
    >
      {total === 0 ? (
        <Vazio texto="Sem dados para os filtros atuais." />
      ) : tabela ? (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {dados.map(d => (
              <tr key={d.nome}>
                <td className="py-1.5 text-slate-700">{d.nome}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{d.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </Card>
  );
};

/** Barras horizontais — melhor leitura para rótulos longos (departamentos, processos...). */
export const BarrasH: React.FC<{ dados: Serie[]; onClick?: (nome: string) => void; larguraRotulo?: number }> = ({ dados, onClick, larguraRotulo = 130 }) => {
  const altura = Math.max(140, dados.length * 34 + 20);
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke="#eef2f7" />
        <XAxis type="number" allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="nome" width={larguraRotulo} tick={eixo} axisLine={false} tickLine={false} interval={0} />
        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Registros']} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={20} onClick={onClick ? (d: unknown) => { const n = (d as { nome?: string; payload?: { nome?: string } }); const alvo = n.nome ?? n.payload?.nome; if (alvo) onClick(alvo); } : undefined} cursor={onClick ? 'pointer' : undefined}>
          {dados.map(d => (
            <Cell key={d.nome} fill={d.cor ?? COR_SERIE} />
          ))}
          <LabelList dataKey="valor" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/** Barras verticais — para poucas categorias ordenadas (ex.: níveis de risco). */
export const BarrasV: React.FC<{ dados: Serie[]; altura?: number }> = ({ dados, altura = 220 }) => (
  <ResponsiveContainer width="100%" height={altura}>
    <BarChart data={dados} margin={{ top: 18, right: 8, left: -20, bottom: 0 }} barCategoryGap="22%">
      <CartesianGrid vertical={false} stroke="#eef2f7" />
      <XAxis dataKey="nome" tick={eixo} axisLine={false} tickLine={false} interval={0} />
      <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Registros']} />
      <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={48}>
        {dados.map(d => (
          <Cell key={d.nome} fill={d.cor ?? COR_SERIE} />
        ))}
        <LabelList dataKey="valor" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

/** Evolução mensal: total acumulado de utilizações registradas (tooltip mostra os novos no mês). */
export const Evolucao: React.FC<{ dados: { mes: string; registros: number; acumulado: number }[] }> = ({ dados }) => (
  <ResponsiveContainer width="100%" height={220}>
    <AreaChart data={dados} margin={{ top: 10, right: 24, left: -20, bottom: 0 }}>
      <defs>
        <linearGradient id="gov-evolucao" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COR_SERIE} stopOpacity={0.22} />
          <stop offset="100%" stopColor={COR_SERIE} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="#eef2f7" />
      <XAxis dataKey="mes" tick={eixo} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
      <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={tooltipStyle}
        formatter={(v: number, _n: string, item: { payload?: { registros: number } }) => [`${v} (novos no mês: ${item.payload?.registros ?? 0})`, 'Utilizações acumuladas']}
      />
      <Area type="monotone" dataKey="acumulado" stroke={COR_SERIE} strokeWidth={2} fill="url(#gov-evolucao)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
    </AreaChart>
  </ResponsiveContainer>
);
