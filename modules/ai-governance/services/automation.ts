/**
 * Barramento de eventos de domínio — ponto único de integração para automações (seção 21).
 *
 * Toda gravação relevante publica um evento aqui. Hoje não há assinantes além do
 * log de desenvolvimento. Futuras integrações apenas se inscrevem, sem tocar nas telas:
 *
 *   automacao.inscrever('uso.submetido', async ev => enviarEmailAoAprovador(ev));
 *   automacao.inscrever('*', ev => fetch(APPS_SCRIPT_WEBHOOK, { method: 'POST', body: JSON.stringify(ev) }));
 *
 * Candidatos: e-mail (Gmail API), Google Chat, Google Apps Script (webhook/gatilho),
 * Google Sheets (espelho de dados), Power BI (push dataset) e APIs externas.
 */
import type { ID, ISODateTime } from '../domain/types';

export type TipoEvento =
  | 'uso.submetido'
  | 'uso.atualizado'
  | 'aprovacao.etapa_avancada'
  | 'aprovacao.decidida'
  | 'aprovacao.homologada'
  | 'uso.revisado'
  | 'risco.ajustado'
  | 'incidente.registrado'
  | 'incidente.atualizado'
  | 'ferramenta.atualizada'
  | 'politica.versionada'
  | 'treinamento.atualizado'
  | 'alerta.reconhecido'
  | 'cadastro.atualizado';

export interface EventoDominio {
  tipo: TipoEvento;
  quando: ISODateTime;
  usuarioId: ID;
  registroId?: ID;
  dados?: Record<string, unknown>;
}

type Assinante = (ev: EventoDominio) => void | Promise<void>;

const assinantes = new Map<TipoEvento | '*', Set<Assinante>>();

export const automacao = {
  inscrever(tipo: TipoEvento | '*', fn: Assinante): () => void {
    if (!assinantes.has(tipo)) assinantes.set(tipo, new Set());
    assinantes.get(tipo)!.add(fn);
    return () => assinantes.get(tipo)?.delete(fn);
  },
  publicar(ev: EventoDominio): void {
    for (const fn of [...(assinantes.get(ev.tipo) ?? []), ...(assinantes.get('*') ?? [])]) {
      // Falha de integração nunca pode quebrar a operação principal.
      Promise.resolve()
        .then(() => fn(ev))
        .catch(err => console.error('[governança-ia] falha em assinante de automação', ev.tipo, err));
    }
  },
};

if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  automacao.inscrever('*', ev => console.debug('[governança-ia] evento', ev.tipo, ev));
}
