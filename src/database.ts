import Database from "better-sqlite3";

import type { FileIndex, SymbolInfo } from "./types";

export interface SearchResult {
  file: FileIndex;
  score: number;
}

export class IndexDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL,
        imports TEXT NOT NULL DEFAULT '[]',
        exports TEXT NOT NULL DEFAULT '[]',
        symbols TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL DEFAULT '',
        hash TEXT NOT NULL,
        indexed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Create FTS5 virtual table if not exists
    // Use a try-catch because FTS5 tables can't use IF NOT EXISTS
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE files_fts USING fts5(
          path, name, description, summary, symbols_text,
          content=files,
          content_rowid=rowid
        );
      `);
    } catch {
      // Table already exists, that's fine
    }

    // Create triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
        INSERT INTO files_fts(rowid, path, name, description, summary, symbols_text)
        VALUES (new.rowid, new.path, new.name, new.description, new.summary, '');
      END;

      CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, path, name, description, summary, symbols_text)
        VALUES ('delete', old.rowid, old.path, old.name, old.description, old.summary, '');
      END;

      CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, path, name, description, summary, symbols_text)
        VALUES ('delete', old.rowid, old.path, old.name, old.description, old.summary, '');
        INSERT INTO files_fts(rowid, path, name, description, summary, symbols_text)
        VALUES (new.rowid, new.path, new.name, new.description, new.summary, '');
      END;
    `);
  }

  getFile(filePath: string): FileIndex | undefined {
    const row = this.db.prepare("SELECT * FROM files WHERE path = ?").get(filePath) as
      | RawFileRow
      | undefined;
    return row ? rowToFileIndex(row) : undefined;
  }

  upsertFile(fileIndex: FileIndex): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, name, description, language, imports, exports, symbols, summary, hash, indexed_at)
      VALUES (@path, @name, @description, @language, @imports, @exports, @symbols, @summary, @hash, @indexed_at)
      ON CONFLICT(path) DO UPDATE SET
        name = @name,
        description = @description,
        language = @language,
        imports = @imports,
        exports = @exports,
        symbols = @symbols,
        summary = @summary,
        hash = @hash,
        indexed_at = @indexed_at
    `);
    stmt.run(fileIndexToRow(fileIndex));

    // Update FTS symbols_text
    this.updateFtsSymbolsText(fileIndex);
  }

  upsertFiles(fileIndexes: FileIndex[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, name, description, language, imports, exports, symbols, summary, hash, indexed_at)
      VALUES (@path, @name, @description, @language, @imports, @exports, @symbols, @summary, @hash, @indexed_at)
      ON CONFLICT(path) DO UPDATE SET
        name = @name,
        description = @description,
        language = @language,
        imports = @imports,
        exports = @exports,
        symbols = @symbols,
        summary = @summary,
        hash = @hash,
        indexed_at = @indexed_at
    `);

    const transaction = this.db.transaction((files: FileIndex[]) => {
      for (const file of files) {
        stmt.run(fileIndexToRow(file));
        this.updateFtsSymbolsText(file);
      }
    });
    transaction(fileIndexes);
  }

  removeFile(filePath: string): void {
    this.db.prepare("DELETE FROM files WHERE path = ?").run(filePath);
  }

  removeFiles(paths: string[]): void {
    const stmt = this.db.prepare("DELETE FROM files WHERE path = ?");
    const transaction = this.db.transaction((pathList: string[]) => {
      for (const p of pathList) {
        stmt.run(p);
      }
    });
    transaction(paths);
  }

  searchFiles(query: string, limit = 20): SearchResult[] {
    // Use FTS5 match query
    const ftsQuery = query
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term.replace(/"/g, '""')}"`)
      .join(" OR ");

    if (!ftsQuery) return [];

    const rows = this.db
      .prepare(
        `
      SELECT f.*, bm25(files_fts) as rank
      FROM files_fts fts
      JOIN files f ON f.rowid = fts.rowid
      WHERE files_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `,
      )
      .all(ftsQuery, limit) as (RawFileRow & { rank: number })[];

    return rows.map((row) => ({
      file: rowToFileIndex(row),
      score: -row.rank, // bm25 returns negative values, lower = better match
    }));
  }

  getAllFiles(): FileIndex[] {
    const rows = this.db.prepare("SELECT * FROM files ORDER BY path").all() as RawFileRow[];
    return rows.map(rowToFileIndex);
  }

  getFileCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM files").get() as { count: number };
    return row.count;
  }

  getLanguageStats(): Record<string, number> {
    const rows = this.db
      .prepare("SELECT language, COUNT(*) as count FROM files GROUP BY language")
      .all() as { language: string; count: number }[];

    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.language] = row.count;
    }
    return stats;
  }

  getMetadata(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM metadata WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setMetadata(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?`,
      )
      .run(key, value, value);
  }

  close(): void {
    this.db.close();
  }

  private updateFtsSymbolsText(fileIndex: FileIndex): void {
    const symbolsText = fileIndex.symbols.map((s) => `${s.name} ${s.description}`).join(" ");
    // Row is guaranteed to exist — this is always called after upsert
    const row = this.db.prepare("SELECT rowid FROM files WHERE path = ?").get(fileIndex.path) as {
      rowid: number;
    };
    // Delete old FTS entry and insert new one with symbols_text
    this.db
      .prepare(
        `INSERT INTO files_fts(files_fts, rowid, path, name, description, summary, symbols_text)
         VALUES ('delete', ?, ?, ?, ?, ?, '')`,
      )
      .run(row.rowid, fileIndex.path, fileIndex.name, fileIndex.description, fileIndex.summary);
    this.db
      .prepare(
        `INSERT INTO files_fts(rowid, path, name, description, summary, symbols_text)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.rowid,
        fileIndex.path,
        fileIndex.name,
        fileIndex.description,
        fileIndex.summary,
        symbolsText,
      );
  }
}

interface RawFileRow {
  path: string;
  name: string;
  description: string;
  language: string;
  imports: string;
  exports: string;
  symbols: string;
  summary: string;
  hash: string;
  indexed_at: number;
}

function rowToFileIndex(row: RawFileRow): FileIndex {
  return {
    path: row.path,
    name: row.name,
    description: row.description,
    language: row.language as FileIndex["language"],
    imports: JSON.parse(row.imports) as string[],
    exports: JSON.parse(row.exports) as string[],
    symbols: JSON.parse(row.symbols) as SymbolInfo[],
    summary: row.summary,
    hash: row.hash,
    indexedAt: row.indexed_at,
  };
}

function fileIndexToRow(fileIndex: FileIndex): Record<string, string | number> {
  return {
    path: fileIndex.path,
    name: fileIndex.name,
    description: fileIndex.description,
    language: fileIndex.language,
    imports: JSON.stringify(fileIndex.imports),
    exports: JSON.stringify(fileIndex.exports),
    symbols: JSON.stringify(fileIndex.symbols),
    summary: fileIndex.summary,
    hash: fileIndex.hash,
    indexed_at: fileIndex.indexedAt,
  };
}
