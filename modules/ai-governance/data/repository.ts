/**
 * Camada de persistência do módulo.
 *
 * As telas e o estado dependem APENAS da interface `GovernanceRepository`.
 * Hoje a implementação é `LocalStorageRepository` (mesmo padrão do painel de riscos).
 * Para integrar Google Sheets, Apps Script ou uma API REST, basta criar outra
 * implementação e trocá-la em `criarRepositorio()` — sem alterar telas.
 */
import type { GovernanceDB } from '../domain/types';
import { criarSeed, SCHEMA_VERSION } from './seed';

export interface GovernanceRepository {
  carregar(): GovernanceDB;
  salvar(db: GovernanceDB): void;
  /** Restaura os dados fictícios de demonstração. */
  restaurarDemonstracao(): GovernanceDB;
}

const CHAVE = 'cicllos_aigov_db';

/** Migrações de schema: cada função leva da versão N para N+1. */
const MIGRACOES: Record<number, (db: GovernanceDB) => GovernanceDB> = {};

const migrar = (db: GovernanceDB): GovernanceDB => {
  let atual = db;
  while (atual.schemaVersion < SCHEMA_VERSION) {
    const m = MIGRACOES[atual.schemaVersion];
    if (!m) return criarSeed(); // sem caminho de migração: recomeça com demonstração
    atual = m(atual);
  }
  return atual;
};

export class LocalStorageRepository implements GovernanceRepository {
  carregar(): GovernanceDB {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) return migrar(JSON.parse(bruto) as GovernanceDB);
    } catch (e) {
      console.error('[governança-ia] falha ao ler dados locais; usando demonstração', e);
    }
    const seed = criarSeed();
    this.salvar(seed);
    return seed;
  }

  salvar(db: GovernanceDB): void {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(db));
    } catch (e) {
      console.error('[governança-ia] falha ao gravar dados locais', e);
    }
  }

  restaurarDemonstracao(): GovernanceDB {
    const seed = criarSeed();
    this.salvar(seed);
    return seed;
  }
}

export const criarRepositorio = (): GovernanceRepository => new LocalStorageRepository();
