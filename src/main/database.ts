import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { GameState, ProviderConfig } from '../shared/contracts';
import { defaultNarrativeRules, narrativeRulesSchema, type NarrativeRules } from '../shared/narrative-rules';
import { createInitialGame, migrateGameState } from './game-engine';

const settingsTable = sqliteTable('settings', {
  id: integer('id').primaryKey(), value: text('value').notNull(),
});
const gamesTable = sqliteTable('games', {
  id: text('id').primaryKey(), value: text('value').notNull(), updatedAt: integer('updated_at').notNull(),
});
const eventsTable = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }), gameId: text('game_id').notNull(),
  type: text('type').notNull(), payload: text('payload').notNull(), createdAt: integer('created_at').notNull(),
});

const defaultSettings: ProviderConfig = {
  provider: 'deepseek', modelId: 'deepseek-v4-flash', baseURL: 'https://api.deepseek.com',
};

export class LocalDatabase {
  private readonly sqlite: Database.Database;
  private readonly db;

  constructor(path: string) {
    this.sqlite = new Database(path);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.exec([
      'CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, value TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);',
      'CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);',
    ].join('\n'));
    this.db = drizzle(this.sqlite);
  }

  getSettings(): ProviderConfig {
    const row = this.db.select().from(settingsTable).where(eq(settingsTable.id, 1)).get();
    if (!row) return defaultSettings;
    const saved = JSON.parse(row.value) as ProviderConfig;
    const isUntouchedLegacyDefault = saved.provider === 'openai'
      && saved.modelId === ''
      && saved.baseURL === 'https://api.openai.com/v1';
    return isUntouchedLegacyDefault ? defaultSettings : saved;
  }

  saveSettings(settings: ProviderConfig): void {
    const value = JSON.stringify(settings);
    this.db.insert(settingsTable).values({ id: 1, value })
      .onConflictDoUpdate({ target: settingsTable.id, set: { value } }).run();
  }

  getNarrativeRules(): NarrativeRules {
    const row = this.db.select().from(settingsTable).where(eq(settingsTable.id, 2)).get();
    if (!row) return defaultNarrativeRules;
    const parsed = narrativeRulesSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : defaultNarrativeRules;
  }

  saveNarrativeRules(rules: NarrativeRules): void {
    const value = JSON.stringify(narrativeRulesSchema.parse(rules));
    this.db.insert(settingsTable).values({ id: 2, value })
      .onConflictDoUpdate({ target: settingsTable.id, set: { value } }).run();
  }

  resetNarrativeRules(): void {
    this.saveNarrativeRules(defaultNarrativeRules);
  }

  getActiveGame(): GameState {
    const row = this.db.select().from(gamesTable).where(eq(gamesTable.id, 'active')).get();
    if (row) {
      const parsed = JSON.parse(row.value) as GameState;
      const game = migrateGameState(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(game)) this.saveGame(game);
      return game;
    }
    const game = createInitialGame(); this.saveGame(game); return game;
  }

  saveGame(game: GameState): void {
    const value = JSON.stringify(game); const updatedAt = Date.now();
    this.db.insert(gamesTable).values({ id: 'active', value, updatedAt })
      .onConflictDoUpdate({ target: gamesTable.id, set: { value, updatedAt } }).run();
  }

  appendEvent(gameId: string, type: string, payload: unknown): void {
    this.db.insert(eventsTable).values({ gameId, type, payload: JSON.stringify(payload), createdAt: Date.now() }).run();
  }

  close(): void { this.sqlite.close(); }
}
