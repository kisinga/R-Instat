/**
 * Vector IPC Handlers
 *
 * Registers all vector-related IPC handlers in one place.
 * Called from main.ts setupIPC() to keep main.ts clean.
 */

import { ipcMain } from 'electron';
import type { EmbeddingService } from './embedding-service';
import type { VectorStoreService, VectorRecord } from './vector-store';
import { indexRSignatures } from './r-signature-indexer';

interface DialogContractForIndex {
  dialogId: string;
  description: string;
  family: string;
  operations: string[];
  keywords: string[];
  paramNames: string[];
}

interface InteractionRecord {
  id: string;
  query: string;
  dialogId: string;
  operationId?: string;
  state: string; // JSON
  success: boolean;
  executionMode?: string;
  confidence?: number;
}

function buildDialogText(contract: DialogContractForIndex): string {
  return [
    contract.dialogId.replace(/-/g, ' '),
    contract.description,
    contract.operations.join(' ').replace(/\./g, ' '),
    contract.keywords.join(' '),
    contract.paramNames.join(' '),
  ].join(' ');
}

export function registerVectorHandlers(
  embedding: EmbeddingService,
  store: VectorStoreService
): void {
  // Lazy init: start services on first call that needs them
  let initPromise: Promise<void> | null = null;
  async function ensureStarted(): Promise<void> {
    if (embedding.healthStatus.status === 'ready' && store.healthStatus.status === 'ready') return;
    if (!initPromise) {
      initPromise = Promise.all([embedding.start(), store.start()])
        .then(() => {})
        .catch((err) => {
          initPromise = null; // Allow retry
          throw err;
        });
    }
    return initPromise;
  }

  // --- Status (doesn't require init) ---
  ipcMain.handle('vector:status', async () => ({
    embedding: embedding.healthStatus,
    vectorStore: store.healthStatus,
  }));

  // --- Raw embedding ---
  ipcMain.handle('vector:embed', async (_event, texts: string[]) => {
    await ensureStarted();
    return embedding.embed(texts);
  });

  // --- Dialog contract indexing ---
  ipcMain.handle('vector:indexDialogs', async (_event, contracts: DialogContractForIndex[]) => {
    await ensureStarted();
    const texts = contracts.map(buildDialogText);
    const vectors = await embedding.embed(texts);

    const records: VectorRecord[] = contracts.map((c, i) => ({
      id: c.dialogId,
      vector: vectors[i],
      description: c.description,
      family: c.family,
      operations: c.operations.join(','),
      keywords: c.keywords.join(','),
    }));

    // Drop and recreate for clean re-index
    await store.dropTable('dialog_contracts');
    await store.upsert('dialog_contracts', records);

    return { indexed: records.length };
  });

  // --- Dialog search ---
  ipcMain.handle(
    'vector:searchDialogs',
    async (_event, query: string, topK: number, familyFilter?: string) => {
      await ensureStarted();
      const queryVec = await embedding.embedOne(query);
      const filter = familyFilter ? `family = '${familyFilter}'` : undefined;
      return store.search('dialog_contracts', queryVec, topK, filter);
    }
  );

  // --- Interaction memory ---
  ipcMain.handle('vector:storeInteraction', async (_event, interaction: InteractionRecord) => {
    await ensureStarted();
    const queryVec = await embedding.embedOne(interaction.query);
    await store.upsert('interactions', [{
      id: interaction.id,
      vector: queryVec,
      query: interaction.query,
      dialogId: interaction.dialogId,
      operationId: interaction.operationId ?? '',
      state: interaction.state,
      success: interaction.success ? 1 : 0, // LanceDB prefers numeric for filtering
      executionMode: interaction.executionMode ?? '',
      confidence: interaction.confidence ?? 0,
      timestamp: Date.now(),
    }]);
    return { stored: true };
  });

  ipcMain.handle(
    'vector:searchInteractions',
    async (_event, query: string, topK: number) => {
      await ensureStarted();
      const queryVec = await embedding.embedOne(query);
      return store.search('interactions', queryVec, topK, 'success = 1');
    }
  );

  // --- R function signature search ---
  ipcMain.handle(
    'vector:searchRSignatures',
    async (_event, query: string, topK: number) => {
      await ensureStarted();
      const queryVec = await embedding.embedOne(query);
      return store.search('r_signatures', queryVec, topK);
    }
  );

  // --- Generic search (for extensibility) ---
  ipcMain.handle(
    'vector:search',
    async (_event, table: string, query: string, topK: number, filter?: string) => {
      await ensureStarted();
      const queryVec = await embedding.embedOne(query);
      return store.search(table, queryVec, topK, filter);
    }
  );

  // --- R signature indexing (triggered after R is ready) ---
  ipcMain.handle(
    'vector:indexRSignatures',
    async (_event, rExecuteFn?: unknown) => {
      // rExecuteFn is not passed via IPC - the caller in main.ts wires this directly
      // This handler is for renderer to check status / trigger via a different mechanism
      const info = await store.tableInfo('r_signatures');
      return { indexed: info.rowCount, exists: info.exists };
    }
  );

  // --- Table info ---
  ipcMain.handle('vector:tableInfo', async (_event, table: string) => {
    return store.tableInfo(table);
  });
}

/**
 * Trigger R signature indexing from the main process.
 * Call this after both R and vector services are ready.
 */
export async function triggerRSignatureIndexing(
  rExecute: (code: string) => Promise<{ success: boolean; result?: { value?: string } }>,
  embedding: EmbeddingService,
  store: VectorStoreService
): Promise<void> {
  try {
    const result = await indexRSignatures(rExecute, embedding, store);
    console.log(`[VectorHandlers] Indexed ${result.indexed} R function signatures`);
  } catch (err) {
    console.warn('[VectorHandlers] R signature indexing failed (non-fatal):', err);
  }
}
