/**
 * Assistente "+ Solicitar nova utilização de IA" (seções 4, 10 e 26).
 *
 * Fluxo curto em 5 passos, com campos condicionais:
 *   1. Quem  → 2. Ferramenta → 3. Finalidade → 4. Dados → 5. Risco e envio
 * O risco é recalculado ao vivo e exibido de forma transparente antes do envio.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { AUTOMACAO_LABEL, DECISAO_LABEL, FINALIDADES, FREQUENCIAS, IMPACTO_LABEL, TIPOS_DADO, TIPO_DADO_AJUDA, TIPO_DADO_PERGUNTA } from '../domain/catalogs';
import type { ClassificacaoDados, ContextoRisco, DecisaoHumana, DetalheDadoSensivel, Frequencia, GrauAutomacao, ImpactoProcesso } from '../domain/types';
import { escopoDe } from '../services/permissions';
import { calcularRisco } from '../services/riskEngine';
import { NovoRegistro, useAcao, useGovernanca } from '../state/GovernanceContext';
import { RiscoTransparente } from './RiscoTransparente';
import { Botao, Campo, CategoriaBadge, Modal, SimNao, cx, inputCls } from './ui';

const PASSOS = ['Quem', 'Ferramenta', 'Finalidade', 'Dados', 'Risco e envio'];

const DADOS_VAZIOS: ClassificacaoDados = { pessoal: false, sensivel: false, cliente: false, financeiro: false, contratual: false, estrategico: false };

export const NovoRegistroWizard: React.FC<{ onFechar: () => void; onCriado: (id: string) => void }> = ({ onFechar, onCriado }) => {
  const g = useGovernanca();
  const executar = useAcao();
  const { db, ix, usuario, usuariosEscopo, hoje } = g;
  const [passo, setPasso] = useState(0);
  const [tentouAvancar, setTentouAvancar] = useState(false);

  const [colaboradorId, setColaboradorId] = useState(escopoDe(usuario) === 'PROPRIO' || usuariosEscopo.some(u => u.id === usuario.id) ? usuario.id : usuariosEscopo[0]?.id ?? '');
  const colab = ix.usuarios.get(colaboradorId);
  const [responsavelProcessoId, setResponsavel] = useState(ix.departamentos.get(colab?.departamentoId ?? '')?.gestorId ?? '');
  const [ferramentaId, setFerramentaId] = useState('');
  const [casoUsoId, setCasoUsoId] = useState('');
  const [processo, setProcesso] = useState('');
  const [atividade, setAtividade] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [frequencia, setFrequencia] = useState<Frequencia>('Semanal');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dados, setDados] = useState<ClassificacaoDados>(DADOS_VAZIOS);
  const [descricaoDados, setDescricaoDados] = useState('');
  const [sensivel, setSensivel] = useState<DetalheDadoSensivel>({ tipo: '', finalidade: '', existeAutorizacao: false, controle: '', responsavelId: '' });
  const [contexto, setContexto] = useState<ContextoRisco>({ impactoProcesso: 'BAIXO', grauAutomacao: 'ASSISTIDO', decisaoHumana: 'SEMPRE' });
  const [controleIds, setControleIds] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');

  const ferramenta = ix.ferramentas.get(ferramentaId);
  const risco = useMemo(
    () => (ferramenta ? calcularRisco({ ferramenta, dados, contexto }, db.configuracoes.pesosRisco) : null),
    [ferramenta, dados, contexto, db.configuracoes.pesosRisco],
  );

  const casosSugeridos = db.casosUso.filter(c => c.status !== 'Descontinuado' && (!ferramentaId || c.ferramentaIds.includes(ferramentaId)));

  const escolherCaso = (id: string) => {
    setCasoUsoId(id);
    const c = ix.casosUso.get(id);
    if (!c) return;
    // Pré-preenche a partir do catálogo: menos digitação, mais padronização.
    if (!processo) setProcesso(c.processo);
    if (!atividade) setAtividade(c.nome);
    setControleIds(ids => [...new Set([...ids, ...c.controleIds])]);
    setDados(d => ({ ...d, ...Object.fromEntries(c.dadosUtilizados.map(t => [t, true])) }));
  };

  // Validação por passo — mensagens aparecem só após tentar avançar.
  const erros: Record<string, string> = {};
  if (passo === 0) {
    if (!colaboradorId) erros.colaborador = 'Selecione o colaborador.';
    if (!responsavelProcessoId) erros.responsavel = 'Informe o responsável pelo processo.';
  }
  if (passo === 1 && !ferramentaId) erros.ferramenta = 'Selecione a ferramenta de IA.';
  if (passo === 2) {
    if (!processo.trim()) erros.processo = 'Informe o processo.';
    if (!atividade.trim()) erros.atividade = 'Descreva a atividade.';
    if (!finalidade.trim()) erros.finalidade = 'Informe a finalidade.';
  }
  if (passo === 3 && dados.sensivel) {
    if (!sensivel.tipo.trim()) erros.sTipo = 'Informe o tipo de dado sensível.';
    if (!sensivel.finalidade.trim()) erros.sFinalidade = 'Informe a finalidade.';
    if (!sensivel.controle.trim()) erros.sControle = 'Informe o controle aplicado.';
    if (!sensivel.responsavelId) erros.sResponsavel = 'Informe o responsável.';
  }
  const valido = Object.keys(erros).length === 0;
  const err = (k: string) => (tentouAvancar ? erros[k] : undefined);

  const avancar = () => {
    if (!valido) return setTentouAvancar(true);
    setTentouAvancar(false);
    setPasso(p => p + 1);
  };

  const enviar = () => {
    const novo: NovoRegistro = {
      colaboradorId, ferramentaId, casoUsoId: casoUsoId || undefined, processo, atividade, finalidade, frequencia, dataInicio,
      responsavelProcessoId, dados, descricaoDados, detalheSensivel: dados.sensivel ? sensivel : undefined, contexto, controleIds, observacoes,
    };
    let id = '';
    const ok = executar(() => {
      const r = g.submeterRegistro(novo);
      id = r.id;
    }, risco?.necessitaAprovacao ? 'Solicitação enviada para aprovação.' : 'Utilização registrada e aprovada automaticamente por política.');
    if (ok) onCriado(id);
  };

  const radioGrupo = <T extends string>(rotulo: string, valor: T, opcoes: Record<T, string>, onChange: (v: T) => void) => (
    <fieldset>
      <legend className="block text-xs font-semibold text-slate-600 mb-1">{rotulo}</legend>
      <div className="grid gap-1.5">
        {(Object.keys(opcoes) as T[]).map(k => (
          <label key={k} className={cx('flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer', valor === k ? 'border-gov-sky bg-gov-light/60' : 'border-slate-200 hover:bg-slate-50')}>
            <input type="radio" className="accent-[#1d4e89]" checked={valor === k} onChange={() => onChange(k)} />
            {opcoes[k]}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <Modal
      aberto
      largura="lg"
      onFechar={onFechar}
      titulo="Solicitar nova utilização de IA"
      subtitulo="Registre como a IA será usada. O risco é calculado automaticamente e de forma transparente."
      rodape={
        <>
          {passo > 0 && <Botao variante="secundario" icone={<ChevronLeft className="w-4 h-4" />} onClick={() => setPasso(p => p - 1)}>Voltar</Botao>}
          {passo < PASSOS.length - 1 ? (
            <Botao onClick={avancar} icone={<ChevronRight className="w-4 h-4" />}>Continuar</Botao>
          ) : (
            <Botao variante="dourado" onClick={enviar} icone={<Send className="w-4 h-4" />}>
              {risco?.necessitaAprovacao ? 'Enviar para aprovação' : 'Registrar utilização'}
            </Botao>
          )}
        </>
      }
    >
      {/* Indicador de passos */}
      <ol className="flex items-center gap-1 mb-5 overflow-x-auto" aria-label="Etapas do cadastro">
        {PASSOS.map((p, i) => (
          <li key={p} className="flex items-center gap-1 shrink-0">
            <span className={cx('w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center', i < passo ? 'bg-emerald-600 text-white' : i === passo ? 'bg-gov-navy text-white' : 'bg-slate-200 text-slate-600')}>
              {i < passo ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={cx('text-xs', i === passo ? 'font-bold text-gov-navy' : 'text-slate-500')}>{p}</span>
            {i < PASSOS.length - 1 && <span className="w-4 h-px bg-slate-300 mx-1" />}
          </li>
        ))}
      </ol>

      {passo === 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo rotulo="Colaborador" obrigatorio erro={err('colaborador')} ajuda={escopoDe(usuario) === 'PROPRIO' ? 'Colaboradores registram apenas o próprio uso.' : undefined}>
            <select className={inputCls} value={colaboradorId} disabled={escopoDe(usuario) === 'PROPRIO'} onChange={e => {
              setColaboradorId(e.target.value);
              const dep = ix.usuarios.get(e.target.value)?.departamentoId;
              setResponsavel(ix.departamentos.get(dep ?? '')?.gestorId ?? '');
            }}>
              <option value="">Selecione…</option>
              {usuariosEscopo.filter(u => u.ativo).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Responsável pelo processo" obrigatorio erro={err('responsavel')} ajuda="Sugerido: gestor da área.">
            <select className={inputCls} value={responsavelProcessoId} onChange={e => setResponsavel(e.target.value)}>
              <option value="">Selecione…</option>
              {db.usuarios.filter(u => u.ativo).map(u => <option key={u.id} value={u.id}>{u.nome} — {u.cargo}</option>)}
            </select>
          </Campo>
          {colab && (
            <div className="sm:col-span-2 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
              <div><p className="text-[10px] font-bold uppercase text-slate-500">Departamento</p>{ix.departamentos.get(colab.departamentoId)?.nome}</div>
              <div><p className="text-[10px] font-bold uppercase text-slate-500">Empresa</p>{ix.empresas.get(colab.empresaId)?.nome}</div>
              <div><p className="text-[10px] font-bold uppercase text-slate-500">Cargo</p>{colab.cargo}</div>
              <p className="col-span-3 text-[11px] text-slate-500">Obtidos do cadastro do colaborador — não são digitados novamente.</p>
            </div>
          )}
        </div>
      )}

      {passo === 1 && (
        <div className="space-y-3">
          {err('ferramenta') && <p className="text-xs text-red-700">{err('ferramenta')}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {db.ferramentas.filter(f => f.status !== 'Descontinuada').map(f => (
              <button key={f.id} type="button" onClick={() => setFerramentaId(f.id)} className={cx('text-left rounded-xl border p-3 transition-all', ferramentaId === f.id ? 'border-gov-navy ring-2 ring-gov-sky/30 bg-gov-light/40' : 'border-slate-200 hover:border-slate-300')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800">{f.nome}</p>
                  <CategoriaBadge categoria={f.categoria} />
                </div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{f.descricao}</p>
                <p className="text-[11px] text-slate-500 mt-1">Uso {f.usoRecomendado.toLowerCase()} · {f.tipo}</p>
              </button>
            ))}
          </div>
          {ferramenta?.categoria === 'NAO_HOMOLOGADA' && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p><strong>Ferramenta não homologada.</strong> Não inserir dados sensíveis, informações de clientes, contratos, apólices, sinistros ou demais informações corporativas protegidas sem autorização. A solicitação passará por avaliação.</p>
            </div>
          )}
          {ferramenta && ferramenta.restricoes.length > 0 && (
            <p className="text-xs text-slate-600"><strong>Restrições:</strong> {ferramenta.restricoes.join(' · ')}</p>
          )}
          {casosSugeridos.length > 0 && (
            <Campo rotulo="Baseado em um caso de uso do catálogo? (opcional)" ajuda="Pré-preenche processo, dados e controles do caso de uso.">
              <select className={inputCls} value={casoUsoId} onChange={e => escolherCaso(e.target.value)}>
                <option value="">Não / novo caso</option>
                {casosSugeridos.map(c => <option key={c.id} value={c.id}>{c.nome} — {ix.departamentos.get(c.departamentoId)?.nome}</option>)}
              </select>
            </Campo>
          )}
        </div>
      )}

      {passo === 2 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo rotulo="Processo" obrigatorio erro={err('processo')}>
            <input className={inputCls} value={processo} onChange={e => setProcesso(e.target.value)} placeholder="Ex.: Regulação de sinistros" />
          </Campo>
          <Campo rotulo="Finalidade" obrigatorio erro={err('finalidade')}>
            <input className={inputCls} list="gov-finalidades" value={finalidade} onChange={e => setFinalidade(e.target.value)} placeholder="Selecione ou digite" />
            <datalist id="gov-finalidades">{FINALIDADES.map(f => <option key={f} value={f} />)}</datalist>
          </Campo>
          <Campo rotulo="Atividade" obrigatorio erro={err('atividade')} className="sm:col-span-2">
            <input className={inputCls} value={atividade} onChange={e => setAtividade(e.target.value)} placeholder="O que exatamente será feito com a IA?" />
          </Campo>
          <Campo rotulo="Frequência de uso">
            <select className={inputCls} value={frequencia} onChange={e => setFrequencia(e.target.value as Frequencia)}>
              {FREQUENCIAS.map(f => <option key={f}>{f}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Data de início">
            <input type="date" className={inputCls} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </Campo>
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600 mb-2">Quais informações serão inseridas na ferramenta de IA?</p>
          {TIPOS_DADO.map(t => (
            <React.Fragment key={t}>
              <SimNao pergunta={TIPO_DADO_PERGUNTA[t]} ajuda={TIPO_DADO_AJUDA[t]} valor={dados[t]} destaque onChange={v => setDados({ ...dados, [t]: v })} />
              {/* Campos condicionais: só aparecem quando há dado sensível (seção 26). */}
              {t === 'sensivel' && dados.sensivel && (
                <div className="grid sm:grid-cols-2 gap-3 rounded-lg border border-red-200 bg-red-50/40 p-3 ml-2 sm:ml-6">
                  <Campo rotulo="Qual tipo de dado sensível?" obrigatorio erro={err('sTipo')}>
                    <input className={inputCls} value={sensivel.tipo} onChange={e => setSensivel({ ...sensivel, tipo: e.target.value })} placeholder="Ex.: laudos médicos" />
                  </Campo>
                  <Campo rotulo="Qual a finalidade?" obrigatorio erro={err('sFinalidade')}>
                    <input className={inputCls} value={sensivel.finalidade} onChange={e => setSensivel({ ...sensivel, finalidade: e.target.value })} />
                  </Campo>
                  <Campo rotulo="Qual controle será aplicado?" obrigatorio erro={err('sControle')}>
                    <input className={inputCls} value={sensivel.controle} onChange={e => setSensivel({ ...sensivel, controle: e.target.value })} placeholder="Ex.: anonimização, DPA" />
                  </Campo>
                  <Campo rotulo="Responsável" obrigatorio erro={err('sResponsavel')}>
                    <select className={inputCls} value={sensivel.responsavelId} onChange={e => setSensivel({ ...sensivel, responsavelId: e.target.value })}>
                      <option value="">Selecione…</option>
                      {db.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </Campo>
                  <div className="sm:col-span-2">
                    <SimNao pergunta="Existe autorização formal (base legal / consentimento)?" valor={sensivel.existeAutorizacao} onChange={v => setSensivel({ ...sensivel, existeAutorizacao: v })} />
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
          {ferramenta?.categoria === 'NAO_HOMOLOGADA' && (dados.cliente || dados.sensivel || dados.contratual) && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>A política proíbe este tipo de dado em ferramenta não homologada sem autorização. Considere usar o Google Gemini (homologado) ou anonimizar os dados.</p>
            </div>
          )}
          <Campo rotulo="Descreva os dados utilizados" className="pt-2">
            <textarea className={inputCls} rows={2} value={descricaoDados} onChange={e => setDescricaoDados(e.target.value)} placeholder="Ex.: planilha de indicadores sem identificação de clientes" />
          </Campo>
        </div>
      )}

      {passo === 4 && risco && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            {radioGrupo<ImpactoProcesso>('Impacto no processo', contexto.impactoProcesso, IMPACTO_LABEL, v => setContexto({ ...contexto, impactoProcesso: v }))}
            {radioGrupo<GrauAutomacao>('Grau de automação', contexto.grauAutomacao, AUTOMACAO_LABEL, v => setContexto({ ...contexto, grauAutomacao: v }))}
            {radioGrupo<DecisaoHumana>('Decisão humana sobre o resultado', contexto.decisaoHumana, DECISAO_LABEL, v => setContexto({ ...contexto, decisaoHumana: v }))}
          </div>
          <div className="space-y-4">
            <RiscoTransparente risco={risco} faixas={db.configuracoes.pesosRisco.faixas} />
            <fieldset>
              <legend className="block text-xs font-semibold text-slate-600 mb-1">Controles aplicados</legend>
              <div className="grid gap-1 max-h-44 overflow-y-auto pr-1">
                {db.controles.map(c => (
                  <label key={c.id} className="flex items-start gap-2 text-sm py-1">
                    <input type="checkbox" className="mt-1 accent-[#1d4e89]" checked={controleIds.includes(c.id)} onChange={e => setControleIds(ids => (e.target.checked ? [...ids, c.id] : ids.filter(x => x !== c.id)))} />
                    <span>{c.nome} <span className="text-xs text-slate-500">({c.tipo})</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Campo rotulo="Observações / justificativa">
              <textarea className={inputCls} rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </Campo>
          </div>
        </div>
      )}
    </Modal>
  );
};
