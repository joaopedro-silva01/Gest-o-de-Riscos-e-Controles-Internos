/**
 * ⚙ Configurações (Administrador).
 * - Matriz de risco (pesos e faixas) e prazos de revisão;
 * - Cadastros de apoio: empresas, departamentos, colaboradores/perfis e controles;
 * - Perfis e permissões (consulta);
 * - Dados: exportação da base, restauração da demonstração e integrações planejadas.
 */
import React, { useState } from 'react';
import { Download, Plus, RotateCcw } from 'lucide-react';
import { BotaoExcluir, SelectUsuario, useRascunho } from '../components/forms';
import { Badge, Botao, Campo, Card, Modal, PageHeader, SimNao, Tabela, cx, inputCls, tdCls, thCls } from '../components/ui';
import { AUTOMACAO_LABEL, CATEGORIAS_HOMOLOGACAO, CATEGORIA_LABEL, DECISAO_LABEL, IMPACTO_LABEL, NIVEIS_RISCO, NIVEL_RISCO_LABEL, PERFIS, PERFIL_LABEL, TIPOS_DADO, TIPO_DADO_LABEL } from '../domain/catalogs';
import type { Configuracoes, Controle, Departamento, Empresa, Perfil, Usuario } from '../domain/types';
import { exportarJson } from '../services/export';
import { nome } from '../services/derived';
import { Permissao, permissoesDe } from '../services/permissions';
import { PESOS_PADRAO } from '../services/riskEngine';
import { useAcao, useGovernanca } from '../state/GovernanceContext';
import { novoId } from '../utils/dates';

type Aba = 'risco' | 'cadastros' | 'perfis' | 'dados';

export const ConfiguracoesPage: React.FC = () => {
  const [aba, setAba] = useState<Aba>('risco');
  return (
    <div className="space-y-5 pb-10">
      <PageHeader selo="Administração" titulo="Configurações" subtitulo="Parâmetros da matriz de risco, cadastros de apoio, perfis de acesso e dados do módulo." />
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto" role="tablist">
        {([['risco', 'Matriz de risco e prazos'], ['cadastros', 'Cadastros de apoio'], ['perfis', 'Perfis e permissões'], ['dados', 'Dados e integrações']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={cx('px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap', aba === k ? 'border-gov-gold text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-800')}>{l}</button>
        ))}
      </div>
      {aba === 'risco' && <MatrizRisco />}
      {aba === 'cadastros' && <Cadastros />}
      {aba === 'perfis' && <Perfis />}
      {aba === 'dados' && <Dados />}
    </div>
  );
};

// --------------------------------------------------------------------------- Matriz

const NumeroPeso: React.FC<{ id: string; rotulo: string; valor: number; onChange: (n: number) => void }> = ({ id, rotulo, valor, onChange }) => (
  <label htmlFor={id} className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-slate-100 last:border-0">
    <span className="text-slate-700">{rotulo}</span>
    <input id={id} type="number" min={0} max={20} className={cx(inputCls, 'w-20 text-right tabular-nums')} value={valor} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} />
  </label>
);

const MatrizRisco: React.FC = () => {
  const { db, salvarConfiguracoes, recalcularRiscos, notificar } = useGovernanca();
  const executar = useAcao();
  const [c, setC] = useState<Configuracoes>(() => JSON.parse(JSON.stringify(db.configuracoes)));
  const p = c.pesosRisco;
  const setP = (fn: (x: typeof p) => typeof p) => setC({ ...c, pesosRisco: fn(p) });
  const alterado = JSON.stringify(c) !== JSON.stringify(db.configuracoes);
  const faixasOk = p.faixas.medio < p.faixas.alto && p.faixas.alto < p.faixas.critico;

  const salvarTudo = () => {
    if (!faixasOk) return executar(() => { throw new Error('As faixas devem ser crescentes: Médio < Alto < Crítico.'); });
    if (executar(() => salvarConfiguracoes(c), 'Configurações salvas.')) {
      // Recalcula após persistir, para que os novos pesos valham para os registros existentes.
      setTimeout(() => {
        let n = 0;
        if (executar(() => { n = recalcularRiscos(); })) notificar(n ? `${n} registro(s) mudaram de pontuação/nível com a nova matriz (auditado).` : 'Nenhum registro mudou com a nova matriz.', 'info');
      }, 0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card titulo="Tipo de ferramenta e exposição" subtitulo="Pontos somados ao risco">
          {CATEGORIAS_HOMOLOGACAO.map(k => <NumeroPeso key={k} id={`pc-${k}`} rotulo={CATEGORIA_LABEL[k]} valor={p.categoria[k]} onChange={n => setP(x => ({ ...x, categoria: { ...x.categoria, [k]: n } }))} />)}
          <NumeroPeso id="pc-exp" rotulo="Exposição externa" valor={p.exposicaoExterna} onChange={n => setP(x => ({ ...x, exposicaoExterna: n }))} />
        </Card>
        <Card titulo="Tipos de dado">
          {TIPOS_DADO.map(k => <NumeroPeso key={k} id={`pd-${k}`} rotulo={TIPO_DADO_LABEL[k]} valor={p.dados[k]} onChange={n => setP(x => ({ ...x, dados: { ...x.dados, [k]: n } }))} />)}
        </Card>
        <Card titulo="Contexto do processo">
          {(Object.keys(IMPACTO_LABEL) as (keyof typeof IMPACTO_LABEL)[]).map(k => <NumeroPeso key={k} id={`pi-${k}`} rotulo={`Impacto ${IMPACTO_LABEL[k].toLowerCase()}`} valor={p.impactoProcesso[k]} onChange={n => setP(x => ({ ...x, impactoProcesso: { ...x.impactoProcesso, [k]: n } }))} />)}
          {(Object.keys(AUTOMACAO_LABEL) as (keyof typeof AUTOMACAO_LABEL)[]).map(k => <NumeroPeso key={k} id={`pa-${k}`} rotulo={AUTOMACAO_LABEL[k]} valor={p.grauAutomacao[k]} onChange={n => setP(x => ({ ...x, grauAutomacao: { ...x.grauAutomacao, [k]: n } }))} />)}
          {(Object.keys(DECISAO_LABEL) as (keyof typeof DECISAO_LABEL)[]).map(k => <NumeroPeso key={k} id={`ph-${k}`} rotulo={DECISAO_LABEL[k]} valor={p.decisaoHumana[k]} onChange={n => setP(x => ({ ...x, decisaoHumana: { ...x.decisaoHumana, [k]: n } }))} />)}
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card titulo="Faixas de pontuação" subtitulo="Pontuação mínima de cada nível">
          <NumeroPeso id="pf-m" rotulo="Médio a partir de" valor={p.faixas.medio} onChange={n => setP(x => ({ ...x, faixas: { ...x.faixas, medio: n } }))} />
          <NumeroPeso id="pf-a" rotulo="Alto a partir de" valor={p.faixas.alto} onChange={n => setP(x => ({ ...x, faixas: { ...x.faixas, alto: n } }))} />
          <NumeroPeso id="pf-c" rotulo="Crítico a partir de" valor={p.faixas.critico} onChange={n => setP(x => ({ ...x, faixas: { ...x.faixas, critico: n } }))} />
          {!faixasOk && <p className="text-xs text-red-700 mt-2">As faixas devem ser crescentes.</p>}
          <p className="text-[11px] text-slate-500 mt-2">As regras de piso (ex.: dado sensível em ferramenta não homologada = Crítico) continuam valendo independentemente dos pesos.</p>
        </Card>
        <Card titulo="Periodicidade de revisão" subtitulo="Meses entre revisões, por nível de risco">
          {NIVEIS_RISCO.map(n => <NumeroPeso key={n} id={`rv-${n}`} rotulo={NIVEL_RISCO_LABEL[n]} valor={c.periodicidadeRevisaoMeses[n]} onChange={v => setC({ ...c, periodicidadeRevisaoMeses: { ...c.periodicidadeRevisaoMeses, [n]: Math.max(1, v) } })} />)}
        </Card>
        <Card titulo="Prazos de alerta">
          <NumeroPeso id="pz-fer" rotulo="Dias sem revisão de ferramenta" valor={c.diasRevisaoFerramenta} onChange={v => setC({ ...c, diasRevisaoFerramenta: v })} />
          <NumeroPeso id="pz-pol" rotulo="Aviso de vencimento de política (dias)" valor={c.diasAvisoPolitica} onChange={v => setC({ ...c, diasAvisoPolitica: v })} />
        </Card>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <Botao variante="fantasma" icone={<RotateCcw className="w-4 h-4" />} onClick={() => setC({ ...c, pesosRisco: PESOS_PADRAO })}>Restaurar pesos padrão</Botao>
        <Botao variante="secundario" disabled={!alterado} onClick={() => setC(JSON.parse(JSON.stringify(db.configuracoes)))}>Descartar</Botao>
        <Botao disabled={!alterado} onClick={salvarTudo}>Salvar e recalcular riscos</Botao>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------- Cadastros

type Tipo = 'empresas' | 'departamentos' | 'usuarios' | 'controles';

const Cadastros: React.FC = () => {
  const { db, ix, salvar, excluir } = useGovernanca();
  const executar = useAcao();
  const [tipo, setTipo] = useState<Tipo>('usuarios');
  const emp = useRascunho<Empresa>(null);
  const dep = useRascunho<Departamento>(null);
  const usr = useRascunho<Usuario>(null);
  const ctl = useRascunho<Controle>(null);
  const P: Permissao = 'configuracoes.gerenciar';

  const exigir = (ok: boolean, msg: string) => { if (!ok) throw new Error(msg); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([['usuarios', `Colaboradores (${db.usuarios.length})`], ['departamentos', `Departamentos (${db.departamentos.length})`], ['empresas', `Empresas (${db.empresas.length})`], ['controles', `Controles (${db.controles.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTipo(k)} className={cx('px-3 py-1.5 rounded-full text-xs font-semibold border', tipo === k ? 'bg-gov-navy text-white border-gov-navy' : 'bg-white text-slate-600 border-slate-300')}>{l}</button>
        ))}
      </div>

      {tipo === 'usuarios' && (
        <Card corpo="p-0 pt-3" titulo="Colaboradores e perfis de acesso" acoes={<Botao tamanho="sm" variante="dourado" icone={<Plus className="w-3.5 h-3.5" />} onClick={() => usr.setRascunho({ id: novoId('usr'), nome: '', email: '', cargo: '', empresaId: db.empresas[0]?.id ?? '', departamentoId: db.departamentos[0]?.id ?? '', perfil: 'COLABORADOR', ativo: true, dataCadastro: new Date().toISOString().slice(0, 10) })}>Novo colaborador</Botao>}>
          <Tabela minWidth={820} cabecalho={<><th className={thCls}>Nome</th><th className={thCls}>Cargo</th><th className={thCls}>Área / empresa</th><th className={thCls}>Perfil</th><th className={thCls}>Situação</th></>}>
            {db.usuarios.map(u => (
              <tr key={u.id} className="hover:bg-gov-light/40 cursor-pointer" onClick={() => usr.setRascunho({ ...u })}>
                <td className={tdCls}><p className="font-medium">{u.nome}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                <td className={cx(tdCls, 'text-xs')}>{u.cargo}</td>
                <td className={cx(tdCls, 'text-xs')}>{ix.departamentos.get(u.departamentoId)?.nome} · {ix.empresas.get(u.empresaId)?.sigla}</td>
                <td className={tdCls}><Badge tom={u.perfil === 'ADMINISTRADOR' ? 'navy' : 'azul'}>{PERFIL_LABEL[u.perfil]}</Badge></td>
                <td className={tdCls}>{u.ativo ? <Badge tom="verde">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
              </tr>
            ))}
          </Tabela>
        </Card>
      )}
      {tipo === 'departamentos' && (
        <Card corpo="p-0 pt-3" titulo="Departamentos" acoes={<Botao tamanho="sm" variante="dourado" icone={<Plus className="w-3.5 h-3.5" />} onClick={() => dep.setRascunho({ id: novoId('dep'), nome: '' })}>Novo departamento</Botao>}>
          <Tabela minWidth={520} cabecalho={<><th className={thCls}>Departamento</th><th className={thCls}>Gestor</th><th className={thCls}>Colaboradores</th></>}>
            {db.departamentos.map(d => (
              <tr key={d.id} className="hover:bg-gov-light/40 cursor-pointer" onClick={() => dep.setRascunho({ ...d })}>
                <td className={cx(tdCls, 'font-medium')}>{d.nome}</td><td className={cx(tdCls, 'text-sm')}>{nome(ix, d.gestorId)}</td>
                <td className={cx(tdCls, 'tabular-nums')}>{db.usuarios.filter(u => u.departamentoId === d.id).length}</td>
              </tr>
            ))}
          </Tabela>
        </Card>
      )}
      {tipo === 'empresas' && (
        <Card corpo="p-0 pt-3" titulo="Empresas do Grupo" acoes={<Botao tamanho="sm" variante="dourado" icone={<Plus className="w-3.5 h-3.5" />} onClick={() => emp.setRascunho({ id: novoId('emp'), nome: '', sigla: '' })}>Nova empresa</Botao>}>
          <Tabela minWidth={420} cabecalho={<><th className={thCls}>Empresa</th><th className={thCls}>Sigla</th><th className={thCls}>Colaboradores</th></>}>
            {db.empresas.map(e => (
              <tr key={e.id} className="hover:bg-gov-light/40 cursor-pointer" onClick={() => emp.setRascunho({ ...e })}>
                <td className={cx(tdCls, 'font-medium')}>{e.nome}</td><td className={tdCls}>{e.sigla}</td><td className={cx(tdCls, 'tabular-nums')}>{db.usuarios.filter(u => u.empresaId === e.id).length}</td>
              </tr>
            ))}
          </Tabela>
        </Card>
      )}
      {tipo === 'controles' && (
        <Card corpo="p-0 pt-3" titulo="Biblioteca de controles" acoes={<Botao tamanho="sm" variante="dourado" icone={<Plus className="w-3.5 h-3.5" />} onClick={() => ctl.setRascunho({ id: novoId('ctl'), nome: '', descricao: '', tipo: 'Preventivo', efetividade: 'Não avaliado' })}>Novo controle</Botao>}>
          <Tabela minWidth={720} cabecalho={<><th className={thCls}>Controle</th><th className={thCls}>Tipo</th><th className={thCls}>Responsável</th><th className={thCls}>Efetividade</th><th className={thCls}>Em uso</th></>}>
            {db.controles.map(x => (
              <tr key={x.id} className="hover:bg-gov-light/40 cursor-pointer" onClick={() => ctl.setRascunho({ ...x })}>
                <td className={tdCls}><p className="font-medium">{x.nome}</p><p className="text-xs text-slate-500">{x.descricao}</p></td>
                <td className={cx(tdCls, 'text-xs')}>{x.tipo}</td><td className={cx(tdCls, 'text-xs')}>{nome(ix, x.responsavelId)}</td>
                <td className={tdCls}><Badge tom={x.efetividade === 'Efetivo' ? 'verde' : x.efetividade === 'Parcial' ? 'amarelo' : 'neutro'}>{x.efetividade}</Badge></td>
                <td className={cx(tdCls, 'tabular-nums')}>{db.registrosUso.filter(r => r.controleIds.includes(x.id)).length}</td>
              </tr>
            ))}
          </Tabela>
        </Card>
      )}

      {usr.rascunho && (() => {
        const u = usr.rascunho;
        const existe = db.usuarios.some(x => x.id === u.id);
        const vinculos = db.registrosUso.some(r => r.colaboradorId === u.id || r.responsavelProcessoId === u.id) || db.auditoria.some(a => a.usuarioId === u.id);
        return (
          <Modal aberto largura="lg" onFechar={() => usr.setRascunho(null)} titulo={existe ? `Editar ${u.nome}` : 'Novo colaborador'}
            rodape={<>
              {existe && <BotaoExcluir bloqueio={vinculos ? 'possui registros/histórico (marque como inativo)' : undefined} onConfirmar={() => executar(() => excluir('usuarios', u.id, 'Colaborador', u.nome, P), 'Colaborador excluído.') && usr.setRascunho(null)} />}
              <Botao variante="secundario" onClick={() => usr.setRascunho(null)}>Cancelar</Botao>
              <Botao onClick={() => executar(() => { exigir(!!u.nome.trim() && /\S+@\S+\.\S+/.test(u.email), 'Informe nome e um e-mail válido.'); salvar('usuarios', u, 'Colaborador', u.nome, P); }, 'Colaborador salvo.') && usr.setRascunho(null)}>Salvar</Botao>
            </>}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo rotulo="Nome" obrigatorio><input id="us-nome" className={inputCls} value={u.nome} onChange={e => usr.set('nome', e.target.value)} /></Campo>
              <Campo rotulo="E-mail corporativo" obrigatorio><input id="us-mail" type="email" className={inputCls} value={u.email} onChange={e => usr.set('email', e.target.value)} /></Campo>
              <Campo rotulo="Cargo"><input id="us-cargo" className={inputCls} value={u.cargo} onChange={e => usr.set('cargo', e.target.value)} /></Campo>
              <Campo rotulo="Perfil de acesso" ajuda="Define o que a pessoa vê e pode fazer."><select id="us-perfil" className={inputCls} value={u.perfil} onChange={e => usr.set('perfil', e.target.value as Perfil)}>{PERFIS.map(p => <option key={p} value={p}>{PERFIL_LABEL[p]}</option>)}</select></Campo>
              <Campo rotulo="Empresa"><select id="us-emp" className={inputCls} value={u.empresaId} onChange={e => usr.set('empresaId', e.target.value)}>{db.empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Campo>
              <Campo rotulo="Departamento"><select id="us-dep" className={inputCls} value={u.departamentoId} onChange={e => usr.set('departamentoId', e.target.value)}>{db.departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></Campo>
              <div className="sm:col-span-2"><SimNao pergunta="Colaborador ativo?" valor={u.ativo} onChange={v => usr.set('ativo', v)} /></div>
            </div>
          </Modal>
        );
      })()}

      {dep.rascunho && (() => {
        const d = dep.rascunho;
        const existe = db.departamentos.some(x => x.id === d.id);
        return (
          <Modal aberto largura="md" onFechar={() => dep.setRascunho(null)} titulo={existe ? `Editar ${d.nome}` : 'Novo departamento'}
            rodape={<>
              {existe && <BotaoExcluir bloqueio={db.usuarios.some(u => u.departamentoId === d.id) || db.casosUso.some(c => c.departamentoId === d.id) ? 'há colaboradores ou casos de uso na área' : undefined} onConfirmar={() => executar(() => excluir('departamentos', d.id, 'Departamento', d.nome, P), 'Departamento excluído.') && dep.setRascunho(null)} />}
              <Botao variante="secundario" onClick={() => dep.setRascunho(null)}>Cancelar</Botao>
              <Botao onClick={() => executar(() => { exigir(!!d.nome.trim(), 'Informe o nome.'); salvar('departamentos', d, 'Departamento', d.nome, P); }, 'Departamento salvo.') && dep.setRascunho(null)}>Salvar</Botao>
            </>}>
            <div className="grid gap-4">
              <Campo rotulo="Nome" obrigatorio><input id="dp-nome" className={inputCls} value={d.nome} onChange={e => dep.set('nome', e.target.value)} /></Campo>
              <Campo rotulo="Gestor" ajuda="Aprova utilizações de risco Baixo/Médio da área."><SelectUsuario id="dp-gest" usuarios={db.usuarios.filter(u => u.perfil === 'GESTOR' || u.perfil === 'ADMINISTRADOR' || u.perfil === 'DIRETORIA')} valor={d.gestorId} onChange={v => dep.set('gestorId', v)} vazio="Sem gestor" /></Campo>
            </div>
          </Modal>
        );
      })()}

      {emp.rascunho && (() => {
        const e = emp.rascunho;
        const existe = db.empresas.some(x => x.id === e.id);
        return (
          <Modal aberto largura="md" onFechar={() => emp.setRascunho(null)} titulo={existe ? `Editar ${e.nome}` : 'Nova empresa'}
            rodape={<>
              {existe && <BotaoExcluir bloqueio={db.usuarios.some(u => u.empresaId === e.id) ? 'há colaboradores vinculados' : undefined} onConfirmar={() => executar(() => excluir('empresas', e.id, 'Empresa', e.nome, P), 'Empresa excluída.') && emp.setRascunho(null)} />}
              <Botao variante="secundario" onClick={() => emp.setRascunho(null)}>Cancelar</Botao>
              <Botao onClick={() => executar(() => { exigir(!!e.nome.trim() && !!e.sigla.trim(), 'Informe nome e sigla.'); salvar('empresas', e, 'Empresa', e.nome, P); }, 'Empresa salva.') && emp.setRascunho(null)}>Salvar</Botao>
            </>}>
            <div className="grid sm:grid-cols-3 gap-4">
              <Campo rotulo="Nome" obrigatorio className="sm:col-span-2"><input id="em-nome" className={inputCls} value={e.nome} onChange={x => emp.set('nome', x.target.value)} /></Campo>
              <Campo rotulo="Sigla" obrigatorio><input id="em-sigla" className={inputCls} maxLength={6} value={e.sigla} onChange={x => emp.set('sigla', x.target.value.toUpperCase())} /></Campo>
            </div>
          </Modal>
        );
      })()}

      {ctl.rascunho && (() => {
        const x = ctl.rascunho;
        const existe = db.controles.some(y => y.id === x.id);
        const emUso = db.registrosUso.some(r => r.controleIds.includes(x.id)) || db.riscos.some(r => r.controleIds.includes(x.id)) || db.casosUso.some(c => c.controleIds.includes(x.id));
        return (
          <Modal aberto largura="md" onFechar={() => ctl.setRascunho(null)} titulo={existe ? `Editar controle` : 'Novo controle'}
            rodape={<>
              {existe && <BotaoExcluir bloqueio={emUso ? 'controle aplicado em registros, riscos ou casos de uso' : undefined} onConfirmar={() => executar(() => excluir('controles', x.id, 'Controle', x.nome, P), 'Controle excluído.') && ctl.setRascunho(null)} />}
              <Botao variante="secundario" onClick={() => ctl.setRascunho(null)}>Cancelar</Botao>
              <Botao onClick={() => executar(() => { exigir(!!x.nome.trim(), 'Informe o nome do controle.'); salvar('controles', x, 'Controle', x.nome, P); }, 'Controle salvo.') && ctl.setRascunho(null)}>Salvar</Botao>
            </>}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo rotulo="Nome" obrigatorio className="sm:col-span-2"><input id="ct-nome" className={inputCls} value={x.nome} onChange={e => ctl.set('nome', e.target.value)} /></Campo>
              <Campo rotulo="Descrição" className="sm:col-span-2"><textarea id="ct-desc" className={inputCls} rows={2} value={x.descricao} onChange={e => ctl.set('descricao', e.target.value)} /></Campo>
              <Campo rotulo="Tipo"><select id="ct-tipo" className={inputCls} value={x.tipo} onChange={e => ctl.set('tipo', e.target.value as Controle['tipo'])}>{(['Preventivo', 'Detectivo', 'Corretivo'] as const).map(t => <option key={t}>{t}</option>)}</select></Campo>
              <Campo rotulo="Efetividade"><select id="ct-ef" className={inputCls} value={x.efetividade} onChange={e => ctl.set('efetividade', e.target.value as Controle['efetividade'])}>{(['Efetivo', 'Parcial', 'Não avaliado'] as const).map(t => <option key={t}>{t}</option>)}</select></Campo>
              <Campo rotulo="Responsável" className="sm:col-span-2"><SelectUsuario id="ct-resp" usuarios={db.usuarios} valor={x.responsavelId} onChange={v => ctl.set('responsavelId', v)} /></Campo>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};

// --------------------------------------------------------------------------- Perfis

const ROTULO_PERM: Record<Permissao, string> = {
  'visao.executiva': 'Visão executiva e indicadores',
  'uso.registrar': 'Registrar / solicitar utilização',
  'uso.editar': 'Editar utilizações da área',
  'aprovacao.decidir': 'Aprovar utilizações (risco Baixo/Médio)',
  'aprovacao.decidir_alto_risco': 'Aprovar utilizações de risco Alto/Crítico',
  'ferramenta.gerenciar': 'Gerenciar ferramentas',
  'caso_uso.gerenciar': 'Gerenciar casos de uso',
  'politica.gerenciar': 'Gerenciar políticas',
  'treinamento.gerenciar': 'Gerenciar treinamentos',
  'incidente.registrar': 'Registrar incidentes',
  'incidente.tratar': 'Tratar incidentes',
  'risco.gerenciar': 'Gerenciar riscos e melhorias',
  'alerta.reconhecer': 'Reconhecer alertas',
  'auditoria.visualizar': 'Consultar trilha de auditoria',
  'configuracoes.gerenciar': 'Configurações do módulo',
  'relatorio.exportar': 'Exportar relatórios',
};
const ESCOPO: Record<Perfil, string> = { ADMINISTRADOR: 'Tudo', GESTOR: 'Sua área', AUDITOR: 'Tudo (leitura)', DIRETORIA: 'Tudo (leitura)', COLABORADOR: 'Seus registros' };

const Perfis: React.FC = () => (
  <Card titulo="Matriz de perfis e permissões" subtitulo="Definida em services/permissions.ts. Em produção, as mesmas regras serão validadas no servidor com login corporativo." corpo="p-0 pt-3">
    <Tabela minWidth={760} cabecalho={<><th className={thCls}>Permissão</th>{PERFIS.map(p => <th key={p} className={cx(thCls, 'text-center')}>{PERFIL_LABEL[p]}</th>)}</>}>
      <tr className="bg-slate-50"><td className={cx(tdCls, 'font-semibold')}>Escopo de dados</td>{PERFIS.map(p => <td key={p} className={cx(tdCls, 'text-center text-xs')}>{ESCOPO[p]}</td>)}</tr>
      {(Object.keys(ROTULO_PERM) as Permissao[]).map(perm => (
        <tr key={perm}>
          <td className={cx(tdCls, 'text-sm')}>{ROTULO_PERM[perm]}</td>
          {PERFIS.map(p => <td key={p} className={cx(tdCls, 'text-center')}>{permissoesDe(p).includes(perm) ? <span className="text-emerald-700 font-bold" aria-label="Permitido">✓</span> : <span className="text-slate-300" aria-label="Não permitido">—</span>}</td>)}
        </tr>
      ))}
    </Tabela>
    <p className="text-[11px] text-slate-500 px-4 py-3">Segregação de funções: ninguém aprova a própria solicitação, e o Gestor só aprova utilizações de colaboradores da sua área.</p>
  </Card>
);

// --------------------------------------------------------------------------- Dados

const INTEGRACOES = [
  ['Google Workspace (SSO)', 'Login corporativo e perfis a partir dos grupos do Workspace'],
  ['Google Sheets / Drive', 'Espelho da base e importação de inventário (GovernanceRepository)'],
  ['Google Apps Script', 'Gatilhos de revisão, lembretes de treinamento e relatórios periódicos'],
  ['E-mail / Google Chat', 'Notificação de aprovadores e responsáveis (barramento de eventos)'],
  ['Power BI', 'Publicação dos indicadores executivos'],
  ['APIs externas / logs', 'Identificação automática de ferramentas de IA não homologadas'],
];

const Dados: React.FC = () => {
  const { db, restaurarDemonstracao, hoje } = useGovernanca();
  const executar = useAcao();
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card titulo="Base de dados do módulo" subtitulo="Nesta fase os dados ficam no navegador. A troca para Google Sheets ou API não exige mudar as telas.">
        <ul className="text-sm text-slate-700 grid grid-cols-2 gap-x-4 gap-y-1 mb-4">
          <li>Registros de uso: <strong>{db.registrosUso.length}</strong></li><li>Ferramentas: <strong>{db.ferramentas.length}</strong></li>
          <li>Casos de uso: <strong>{db.casosUso.length}</strong></li><li>Colaboradores: <strong>{db.usuarios.length}</strong></li>
          <li>Incidentes: <strong>{db.incidentes.length}</strong></li><li>Eventos de auditoria: <strong>{db.auditoria.length}</strong></li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" icone={<Download className="w-4 h-4" />} onClick={() => exportarJson(db, `governanca-ia-base-${hoje}.json`)}>Exportar base (JSON)</Botao>
          {confirmar ? (
            <>
              <Botao variante="perigo" onClick={() => { executar(() => restaurarDemonstracao()); setConfirmar(false); }}>Confirmar: apagar e restaurar demonstração</Botao>
              <Botao variante="fantasma" onClick={() => setConfirmar(false)}>Cancelar</Botao>
            </>
          ) : <Botao variante="fantasma" icone={<RotateCcw className="w-4 h-4" />} onClick={() => setConfirmar(true)}>Restaurar dados de demonstração</Botao>}
        </div>
        {confirmar && <p className="text-xs text-red-700 mt-2">Todos os dados cadastrados neste navegador serão substituídos pelos dados fictícios.</p>}
      </Card>
      <Card titulo="Integrações previstas" subtitulo="Arquitetura preparada; ativação em etapas futuras">
        <ul className="divide-y divide-slate-100">
          {INTEGRACOES.map(([n, d]) => (
            <li key={n} className="py-2 flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold text-slate-800">{n}</p><p className="text-xs text-slate-500">{d}</p></div>
              <Badge tom="dourado">Planejada</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
