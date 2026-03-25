/**
 * VectorStoreService
 *
 * LanceDB wrapper for persistent vector storage and similarity search.
 * Runs in the Electron main process. DB stored as files in userData.
 *
 * Follows the RBridge lifecycle pattern: start() / stop() / healthStatus.
 */

import { app } from 'electron';
import * as path from 'path';

export type VectorStoreHealthStatus = {
  status: 'idle' | 'initializing' | 'ready' | 'error';
  error?: string;
  tables?: string[];
};

export interface VectorRecord {
  id: string;
  vector: number[];
  [key: string]: unknown;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

// LanceDB types (loaded dynamically)
type LanceConnection = {
  tableNames: () => Promise<string[]>;
  createTable: (name: string, data: unknown[]) => Promise<unknown>;
  openTable: (name: string) => Promise<LanceTable>;
  dropTable: (name: string) => Promise<void>;
};

type LanceTable = {
  add: (data: unknown[]) => Promise<void>;
  search: (vector: number[]) => LanceQuery;
  countRows: () => Promise<number>;
  delete: (filter: string) => Promise<void>;
};

type LanceQuery = {
  limit: (n: number) => LanceQuery;
  where: (filter: string) => LanceQuery;
  toArray: () => Promise<Array<Record<string, unknown>>>;
};

export class VectorStoreService {
  private db: LanceConnection | null = null;
  private _healthStatus: VectorStoreHealthStatus = { status: 'idle' };
  private _statusListeners: Array<(status: VectorStoreHealthStatus) => void> = [];
  private dbPath: string;

  constructor() {
    this.dbPath = app.isPackaged
      ? path.join(app.getPath('userData'), 'vector-db')
      : path.join(__dirname, '..', '.data', 'vector-db');
  }

  get healthStatus(): VectorStoreHealthStatus {
    return this._healthStatus;
  }

  onStatusChange(listener: (status: VectorStoreHealthStatus) => void): () => void {
    this._statusListeners.push(listener);
    return () => {
      this._statusListeners = this._statusListeners.filter(l => l !== listener);
    };
  }

  private setStatus(status: VectorStoreHealthStatus): void {
    this._healthStatus = status;
    for (const listener of this._statusListeners) {
      listener(status);
    }
  }

  async start(): Promise<void> {
    if (this._healthStatus.status === 'ready') return;

    this.setStatus({ status: 'initializing' });

    try {
      const lancedb = await import('@lancedb/lancedb');
      const connectFn = lancedb.connect as (uri: string) => Promise<unknown>;
      this.db = await connectFn(this.dbPath) as LanceConnection;

      const tables = await this.db.tableNames();
      this.setStatus({ status: 'ready', tables });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus({ status: 'error', error: message });
      throw err;
    }
  }

  /**
   * Insert or replace records in a table. Creates the table if it doesn't exist.
   */
  async upsert(tableName: string, records: VectorRecord[]): Promise<void> {
    if (!this.db) throw new Error('VectorStoreService not started');
    if (records.length === 0) return;

    const tables = await this.db.tableNames();

    if (tables.includes(tableName)) {
      const table = await this.db.openTable(tableName);
      // Delete existing records with matching IDs, then add new ones
      const ids = records.map(r => r.id);
      for (const id of ids) {
        try {
          await table.delete(`id = '${id.replace(/'/g, "''")}'`);
        } catch {
          // Record may not exist yet - that's fine
        }
      }
      await table.add(records);
    } else {
      await this.db.createTable(tableName, records);
    }
  }

  /**
   * Search for similar vectors in a table.
   * Returns results sorted by similarity (highest first).
   */
  async search(
    tableName: string,
    queryVector: number[],
    topK: number,
    filter?: string
  ): Promise<VectorSearchResult[]> {
    if (!this.db) throw new Error('VectorStoreService not started');

    const tables = await this.db.tableNames();
    if (!tables.includes(tableName)) return [];

    const table = await this.db.openTable(tableName);
    let query = table.search(queryVector).limit(topK);

    if (filter) {
      query = query.where(filter);
    }

    const results = await query.toArray();

    return results.map(row => {
      const { id, vector: _v, _distance, ...metadata } = row;
      return {
        id: String(id),
        // LanceDB returns L2 distance; convert to similarity score (0-1)
        score: 1 / (1 + ((_distance as number) ?? 0)),
        metadata,
      };
    });
  }

  /**
   * Check if a table exists and return its row count.
   */
  async tableInfo(tableName: string): Promise<{ exists: boolean; rowCount: number }> {
    if (!this.db) throw new Error('VectorStoreService not started');

    const tables = await this.db.tableNames();
    if (!tables.includes(tableName)) return { exists: false, rowCount: 0 };

    const table = await this.db.openTable(tableName);
    const count = await table.countRows();
    return { exists: true, rowCount: count };
  }

  /**
   * Drop a table entirely.
   */
  async dropTable(tableName: string): Promise<void> {
    if (!this.db) throw new Error('VectorStoreService not started');
    try {
      await this.db.dropTable(tableName);
    } catch {
      // Table may not exist
    }
  }

  stop(): void {
    this.db = null;
    this.setStatus({ status: 'idle' });
  }
}
