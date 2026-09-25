/**
 * Ficha completa de um Registro de Uso de IA:
 * dados, classificação, risco transparente, fluxo de homologação (com ações
 * conforme permissão) e histórico de auditoria do registro.
 */
import React, { useState } from 'react';
import { CheckCircle2, Circle, CircleDot, XCircle, MinusCircle, History } from 'lucide-react';
import { ETAPA_LABEL, NIVEIS_RISCO, NIVEL_RISCO_LABEL, STATUS_AUTORIZADOS, TIPOS_DADO, TIPO_DADO_LABEL, IMPACTO_LABEL, AUTOMACAO_LABEL, DECISAO_LABEL } from '../domain/catalogs';
import type { EtapaAprovacao, NivelRisco } from '../domain/types';
import { valorLegivel } from '../services/audit';
import { departamentoDoRegistro, empresaDoRegistro, nome } from '../services/derived';
import { podeDecidir } from '../services/permissions';
import * as wf from '../services/workflow';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { formatarData, formatarDataHora } from '../utils/dates';
import { RiscoTransparente } from './RiscoTransparente';
import { Badge, Botao, CategoriaBadge, Info, Modal, StatusBadge, cx, inputCls } from './ui';

const IconeEtapa: React.FC<{ e: EtapaAprovacao }> = ({ e }) => {
  const cls = 'w-5 h-5 shrink-0';
  if (e.status === 'Concluída') return <CheckCircle2 className={cx(cls, 'text-emerald-600')} aria-label="Concluída" />;
  if (e.status === 'Em andamento') return <CircleDot className={cx(cls, 'text-gov-sky')} aria-label="Em andamento" />;
  if (e.status === 'Reprovada') return <XCircle className={cx(cls, 'text-red-700')} aria-label="Reprovada" />;
  if (e.status === 'Não aplicável') return <MinusCircle className={cx(cls, 'text-slate-300')} aria-label="Não aplicável" />;
  return <Circle className={cx(cls, 'text-slate-300')} aria-label="Pendente" />;
};

export const RegistroDetalhe: React.FC<{ registroId: string; onFechar: () => void }> = ({ registroId, onFechar }) => {
  const g = useGovernanca();
  const executar = useAcao();
  const { db, ix, usuario } = g;
  const r = db.registrosUso.find(x => x.id === registroId);
  const [obs, setObs] = useState('');
  const [ajuste, setAjuste] = useState<{ nivel: NivelRisco; just: string } | null>(null);
  const [aba, setAba] = useState<'resumo' | 'fluxo' | 'historico'>('resumo');

  if (!r) return null;
  const ferramenta = ix.ferramentas.get(r.ferramentaId);
  const colab = ix.usuarios.get(r.colaboradorId);
  const aprov = r.aprovacaoId ? ix.aprovacoes.get(r.aprovacaoId) : undefined;
  const atual = aprov && wf.etapaAtual(aprov);
  const decisor = podeDecidir(db, usuario, r);
  const historico = db.auditoria.filter(a => a.registroId === r.id || (aprov && a.registroId === aprov.id));
  const autorizado = STATUS_AUTORIZADOS.includes(r.status);
  const ok = (fn: () => void, msg: string) => executar(fn, msg) && setObs('');

  const acoesFluxo = aprov && decisor.ok && (
    <div className="rounded-xl border border-gov-sky/30 bg-gov-light/50 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gov-blue">Ação do avaliador</p>
      <textarea className={inputCls} rows={2} placeholder="Observação / justificativa (registrada no fluxo e na auditoria)" value={obs} onChange={e => setObs(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {wf.podeAvancar(aprov) && atual && (
          <Botao onClick={() => ok(() => g.avancarEtapa(aprov.id, obs), `Etapa "${ETAPA_LABEL[atual.etapa]}" concluída.`)}>
            Concluir etapa: {ETAPA_LABEL[atual.etapa]}
          </Botao>
        )}
        {wf.aguardandoDecisao(aprov) && (
          <>
            <Botao onClick={() => ok(() => g.decidir(aprov.id, 'Aprovado', obs), 'Utilização aprovada.')}>Aprovar</Botao>
            <Botao variante="dourado" onClick={() => ok(() => g.decidir(aprov.id, 'Aprovado com restrições', obs), 'Aprovada com restrições.')}>Aprovar com restrições</Botao>
            <Botao variante="perigo" onClick={() => ok(() => g.decidir(aprov.id, 'Não aprovado', obs), 'Utilização não aprovada.')}>Não aprovar</Botao>
          </>
        )}
        {wf.aguardandoHomologacao(aprov) && (
          <Botao onClick={() => ok(() => g.homologar(aprov.id, obs), 'Homologação concluída; uso em monitoramento.')}>Concluir homologação</Botao>
        )}
        {autorizado && !wf.aguardandoHomologacao(aprov) && (
          <Botao variante="secundario" onClick={() => ok(() => g.registrarRevisao(r.id, obs), 'Revisão registrada.')}>Registrar revisão periódica</Botao>
        )}
        {autorizado && (
          <Botao variante="secundario" onClick={() => ok(() => g.alterarStatusRegistro(r.id, 'Suspenso', obs || 'Uso suspenso.'), 'Uso suspenso.')}>Suspender</Botao>
        )}
        {r.status === 'Suspenso' && (
          <Botao variante="secundario" onClick={() => ok(() => g.alterarStatusRegistro(r.id, 'Em monitoramento', obs || 'Uso reativado sob monitoramento.'), 'Uso reativado.')}>Reativar em monitoramento</Botao>
        )}
        {r.status !== 'Encerrado' && r.status !== 'Não aprovado' && (
          <Botao variante="fantasma" onClick={() => ok(() => g.alterarStatusRegistro(r.id, 'Encerrado', obs || 'Uso encerrado.'), 'Uso encerrado.')}>Encerrar uso</Botao>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      aberto
      largura="xl"
      onFechar={onFechar}
      titulo={<span className="flex flex-wrap items-center gap-2">{r.codigo} · {r.atividade} <StatusBadge status={r.status} /></span>}
      subtitulo={`${colab?.nome ?? '—'} · ${ix.departamentos.get(departamentoDoRegistro(ix, r) ?? '')?.nome ?? '—'} · ${ix.empresas.get(empresaDoRegistro(ix, r) ?? '')?.nome ?? '—'}`}
    >
      <div className="flex gap-1 border-b border-slate-200 mb-4 -mt-1" role="tablist">
        {([['resumo', 'Resumo e risco'], ['fluxo', 'Fluxo de homologação'], ['historico', `Histórico (${historico.length})`]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cx('px-3 py-2 text-sm font-semibold border-b-2 -mb-px', aba === k ? 'border-gov-gold text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {l}
          </button>
        ))}
      </div>

      {aba === 'resumo' && (
        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-5">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Info rotulo="Ferramenta"><span className="flex flex-col gap-1 items-start">{ferramenta?.nome}{ferramenta && <CategoriaBadge categoria={ferramenta.categoria} />}</span></Info>
              <Info rotulo="Cargo">{colab?.cargo}</Info>
              <Info rotulo="Caso de uso">{r.casoUsoId ? ix.casosUso.get(r.casoUsoId)?.nome : '—'}</Info>
              <Info rotulo="Processo">{r.processo}</Info>
              <Info rotulo="Finalidade">{r.finalidade}</Info>
              <Info rotulo="Frequência">{r.frequencia}</Info>
              <Info rotulo="Data de início">{formatarData(r.dataInicio)}</Info>
              <Info rotulo="Responsável pelo processo">{r.responsavelProcessoId ? nome(ix, r.responsavelProcessoId) : <Badge tom="laranja">Sem responsável</Badge>}</Info>
              <Info rotulo="Responsável pela aprovação">{aprov?.aprovadorId ? nome(ix, aprov.aprovadorId) : aprov?.automatica ? 'Automática (política)' : 'Pendente'}</Info>
              <Info rotulo="Última revisão">{formatarData(r.ultimaRevisao)}</Info>
              <Info rotulo="Próxima revisão">
                {r.proximaRevisao ? <span className={cx(r.proximaRevisao < g.hoje && autorizado && 'text-red-700 font-semibold')}>{formatarData(r.proximaRevisao)}{r.proximaRevisao < g.hoje && autorizado && ' (vencida)'}</span> : '—'}
              </Info>
              <Info rotulo="Contexto">
                Impacto {IMPACTO_LABEL[r.contexto.impactoProcesso].toLowerCase()} · {AUTOMACAO_LABEL[r.contexto.grauAutomacao]} · {DECISAO_LABEL[r.contexto.decisaoHumana]}
              </Info>
            </dl>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Classificação dos dados</p>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS_DADO.map(t => (
                  <Badge key={t} tom={r.dados[t] ? (t === 'sensivel' ? 'vermelho' : 'laranja') : 'neutro'} className={r.dados[t] ? '' : 'opacity-60'}>
                    {TIPO_DADO_LABEL[t]}: {r.dados[t] ? 'SIM' : 'NÃO'}
                  </Badge>
                ))}
              </div>
              {r.descricaoDados && <p className="text-sm text-slate-700 mt-2">{r.descricaoDados}</p>}
              {r.detalheSensivel && (
                <dl className="grid grid-cols-2 gap-3 mt-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
                  <Info rotulo="Tipo de dado sensível">{r.detalheSensivel.tipo}</Info>
                  <Info rotulo="Finalidade do tratamento">{r.detalheSensivel.finalidade}</Info>
                  <Info rotulo="Existe autorização?">{r.detalheSensivel.existeAutorizacao ? 'Sim' : <Badge tom="vermelho">Não</Badge>}</Info>
                  <Info rotulo="Controle">{r.detalheSensivel.controle}</Info>
                  <Info rotulo="Responsável">{nome(ix, r.detalheSensivel.responsavelId)}</Info>
                </dl>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Controles aplicados</p>
              {r.controleIds.length ? (
                <ul className="space-y-1">
                  {r.controleIds.map(id => {
                    const c = ix.controles.get(id);
                    return c ? <li key={id} className="text-sm text-slate-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{c.nome} <span className="text-xs text-slate-500">({c.tipo})</span></li> : null;
                  })}
                </ul>
              ) : (
                <Badge tom="laranja">Nenhum controle aplicado</Badge>
              )}
            </div>
            {r.observacoes && <Info rotulo="Observações"><span className="whitespace-pre-line">{r.observacoes}</span></Info>}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <RiscoTransparente risco={r.risco} ajuste={r.ajusteRisco} faixas={db.configuracoes.pesosRisco.faixas} />
            {decisor.ok && r.status !== 'Encerrado' && (
              ajuste ? (
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600">Ajustar nível de risco</p>
                  <select className={inputCls} value={ajuste.nivel} onChange={e => setAjuste({ ...ajuste, nivel: e.target.value as NivelRisco })}>
                    {NIVEIS_RISCO.map(n => <option key={n} value={n}>{NIVEL_RISCO_LABEL[n]}</option>)}
                  </select>
                  <textarea className={inputCls} rows={2} placeholder="Justificativa obrigatória" value={ajuste.just} onChange={e => setAjuste({ ...ajuste, just: e.target.value })} />
                  <div className="flex gap-2 justify-end">
                    <Botao tamanho="sm" variante="fantasma" onClick={() => setAjuste(null)}>Cancelar</Botao>
                    <Botao tamanho="sm" onClick={() => executar(() => g.ajustarRisco(r.id, ajuste.nivel, ajuste.just), 'Nível de risco ajustado.') && setAjuste(null)}>Salvar ajuste</Botao>
                  </div>
                </div>
              ) : (
                <button className="text-xs font-semibold text-gov-blue hover:underline" onClick={() => setAjuste({ nivel: r.ajusteRisco?.nivel ?? r.risco.nivelSugerido, just: '' })}>
                  Ajustar nível de risco (com justificativa)
                </button>
              )
            )}
          </div>
        </div>
      )}

      {aba === 'fluxo' && aprov && (
        <div className="grid lg:grid-cols-5 gap-5">
          <ol className="lg:col-span-3 space-y-0">
            {aprov.etapas.map((e, i) => (
              <li key={e.etapa} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <IconeEtapa e={e} />
                  {i < aprov.etapas.length - 1 && <span className={cx('w-px flex-1 my-1', e.status === 'Concluída' ? 'bg-emerald-300' : 'bg-slate-200')} />}
                </div>
                <div className="pb-4 min-w-0">
                  <p className={cx('text-sm font-semibold', e.status === 'Em andamento' ? 'text-gov-blue' : 'text-slate-800')}>
                    {ETAPA_LABEL[e.etapa]} <span className="font-normal text-xs text-slate-500">· {e.status}</span>
                  </p>
                  {(e.responsavelId || e.data) && (
                    <p className="text-xs text-slate-500">{e.responsavelId ? nome(ix, e.responsavelId) : 'Sistema'} · {formatarDataHora(e.data)}</p>
                  )}
                  {e.observacao && <p className="text-xs text-slate-700 mt-0.5">{e.observacao}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div className="lg:col-span-2 space-y-3">
            {acoesFluxo}
            {!decisor.ok && r.status !== 'Encerrado' && (
              <p className="text-xs text-slate-600 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <strong>Somente leitura:</strong> {decisor.motivo}
              </p>
            )}
            {aprov.decisao && (
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-bold uppercase text-slate-500">Decisão</p>
                <p className="font-semibold mt-0.5">{aprov.decisao}{aprov.automatica && ' (automática)'}</p>
                {aprov.justificativa && <p className="text-xs text-slate-600 mt-1">{aprov.justificativa}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <ul className="space-y-3">
          {historico.map(ev => (
            <li key={ev.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm flex flex-wrap items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <Badge tom="azul">{ev.acao}</Badge>
                <span className="font-semibold">{nome(ix, ev.usuarioId)}</span>
                <span className="text-xs text-slate-500">{formatarDataHora(ev.dataHora)}</span>
              </p>
              {ev.alteracoes.length > 0 && (
                <ul className="mt-2 text-xs text-slate-600 space-y-0.5">
                  {ev.alteracoes.slice(0, 12).map((a, i) => (
                    <li key={i}><strong>{a.campo}:</strong> <span className="line-through opacity-70">{valorLegivel(a.anterior)}</span> → {valorLegivel(a.novo)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {!historico.length && <p className="text-sm text-slate-500">Sem eventos.</p>}
        </ul>
      )}
    </Modal>
  );
};
