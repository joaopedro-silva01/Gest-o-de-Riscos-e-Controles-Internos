/**
 * Página provisória para itens de menu cujas telas entram nas próximas etapas.
 * Mostra o escopo planejado e os dados que JÁ existem no modelo, para validação.
 */
import React from 'react';
import { Construction } from 'lucide-react';
import { Card, PageHeader } from '../components/ui';

export interface PlanoPagina {
  titulo: string;
  selo: string;
  etapa: number;
  escopo: string[];
  dadosDisponiveis: string;
}

export const EmConstrucaoPage: React.FC<{ plano: PlanoPagina }> = ({ plano }) => (
  <div className="space-y-5 pb-10">
    <PageHeader selo={plano.selo} titulo={plano.titulo} />
    <Card>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-12 h-12 rounded-xl bg-gov-goldsoft text-gov-golddeep flex items-center justify-center shrink-0">
          <Construction className="w-6 h-6" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="font-bold text-gov-navy">Planejado para a Etapa {plano.etapa}</p>
            <p className="text-sm text-slate-600">O modelo de dados, as regras e os dados de demonstração desta área já existem; a tela será entregue na etapa indicada.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Escopo</p>
            <ul className="list-disc ml-5 text-sm text-slate-700 space-y-0.5">{plano.escopo.map(e => <li key={e}>{e}</li>)}</ul>
          </div>
          <p className="text-xs text-slate-500">Dados já disponíveis: {plano.dadosDisponiveis}</p>
        </div>
      </div>
    </Card>
  </div>
);
