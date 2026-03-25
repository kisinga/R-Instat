/**
 * R Signature Indexer
 *
 * After R is ready, extracts function signatures from core packages
 * and indexes them in the vector store for semantic search.
 * Runs as a background task - doesn't block anything.
 */

import type { EmbeddingService } from './embedding-service';
import type { VectorStoreService, VectorRecord } from './vector-store';

// Core packages to index. These cover ~90% of direct_r use cases.
const CORE_PACKAGES = ['base', 'stats', 'ggplot2', 'dplyr', 'tidyr'];

interface RSignatureEntry {
  name: string;
  package: string;
  signature: string;
  params: string;
}

/**
 * Index R function signatures from core packages.
 * Call this after both R and embedding services are ready.
 *
 * @param rExecute Function to execute R code and get results (from RBridge)
 * @param embedding EmbeddingService for vectorizing signatures
 * @param store VectorStoreService for persistent storage
 */
export async function indexRSignatures(
  rExecute: (code: string) => Promise<{ success: boolean; result?: { value?: string } }>,
  embedding: EmbeddingService,
  store: VectorStoreService
): Promise<{ indexed: number }> {
  // Check if already indexed
  const info = await store.tableInfo('r_signatures');
  if (info.exists && info.rowCount > 50) {
    return { indexed: info.rowCount };
  }

  const allSignatures: RSignatureEntry[] = [];

  for (const pkg of CORE_PACKAGES) {
    try {
      const code = `
        tryCatch({
          fns <- ls("package:${pkg}")
          results <- lapply(fns, function(f) {
            fn <- tryCatch(get(f, envir = asNamespace("${pkg}")), error = function(e) NULL)
            if (!is.function(fn)) return(NULL)
            params <- tryCatch(paste(names(formals(fn)), collapse = ", "), error = function(e) "")
            sig <- tryCatch(paste0(f, "(", params, ")"), error = function(e) f)
            list(name = f, signature = sig, params = params)
          })
          results <- Filter(Negate(is.null), results)
          jsonlite::toJSON(results, auto_unbox = TRUE)
        }, error = function(e) "[]")
      `;

      const result = await rExecute(code);
      if (result.success && result.result?.value) {
        const parsed = JSON.parse(String(result.result.value)) as Array<{
          name: string;
          signature: string;
          params: string;
        }>;
        for (const fn of parsed) {
          allSignatures.push({
            name: fn.name,
            package: pkg,
            signature: fn.signature,
            params: fn.params,
          });
        }
      }
    } catch {
      // Package not available or parse error - skip
      console.warn(`[RSignatureIndexer] Failed to index package: ${pkg}`);
    }
  }

  if (allSignatures.length === 0) return { indexed: 0 };

  // Embed signatures
  const texts = allSignatures.map(s => `${s.name} ${s.package} ${s.params}`);
  const vectors = await embedding.embed(texts);

  const records: VectorRecord[] = allSignatures.map((s, i) => ({
    id: `${s.package}::${s.name}`,
    vector: vectors[i],
    functionName: s.name,
    package: s.package,
    signature: s.signature,
    paramNames: s.params,
  }));

  await store.dropTable('r_signatures');
  await store.upsert('r_signatures', records);

  return { indexed: records.length };
}
