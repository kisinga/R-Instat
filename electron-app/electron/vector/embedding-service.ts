/**
 * EmbeddingService
 *
 * Loads a local ONNX embedding model (all-MiniLM-L6-v2) via Transformers.js
 * and provides batch text embedding. Runs in the Electron main process.
 *
 * Follows the RBridge lifecycle pattern: start() / stop() / healthStatus.
 */

import * as path from 'path';
import { app } from 'electron';

export type EmbeddingHealthStatus = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  modelId?: string;
};

// Transformers.js types (loaded dynamically since it's ESM-only)
type Pipeline = (texts: string[], options?: { pooling: string; normalize: boolean }) => Promise<{ tolist: () => number[][] }>;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;

export { EMBEDDING_DIM };

export class EmbeddingService {
  private pipeline: Pipeline | null = null;
  private _healthStatus: EmbeddingHealthStatus = { status: 'idle' };
  private _statusListeners: Array<(status: EmbeddingHealthStatus) => void> = [];

  get healthStatus(): EmbeddingHealthStatus {
    return this._healthStatus;
  }

  onStatusChange(listener: (status: EmbeddingHealthStatus) => void): () => void {
    this._statusListeners.push(listener);
    return () => {
      this._statusListeners = this._statusListeners.filter(l => l !== listener);
    };
  }

  private setStatus(status: EmbeddingHealthStatus): void {
    this._healthStatus = status;
    for (const listener of this._statusListeners) {
      listener(status);
    }
  }

  async start(): Promise<void> {
    if (this._healthStatus.status === 'ready') return;

    this.setStatus({ status: 'loading', modelId: MODEL_ID });

    try {
      // Dynamic import: Transformers.js v3 is ESM-only.
      // Node16 module target preserves import() as a real ESM dynamic import.
      const { pipeline, env } = await import('@huggingface/transformers');

      // Configure for local-only operation
      env.allowRemoteModels = true; // Allow download on first run, then cached
      env.useBrowserCache = false;

      // Set local cache path for packaged app
      const cachePath = app.isPackaged
        ? path.join(app.getPath('userData'), 'models')
        : path.join(__dirname, '..', 'assets', 'models');
      env.cacheDir = cachePath;

      // Load the feature-extraction pipeline
      this.pipeline = await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'q8', // Quantized model for smaller size + faster inference
      }) as unknown as Pipeline;

      this.setStatus({ status: 'ready', modelId: MODEL_ID });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus({ status: 'error', error: message, modelId: MODEL_ID });
      throw err;
    }
  }

  /**
   * Embed one or more texts into 384-dim vectors.
   * Returns an array of number arrays, one per input text.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.pipeline) {
      throw new Error('EmbeddingService not started');
    }
    if (texts.length === 0) return [];

    const output = await this.pipeline(texts, {
      pooling: 'mean',
      normalize: true,
    });

    return output.tolist();
  }

  /**
   * Embed a single text. Convenience wrapper.
   */
  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    return vec;
  }

  stop(): void {
    this.pipeline = null;
    this.setStatus({ status: 'idle' });
  }
}
