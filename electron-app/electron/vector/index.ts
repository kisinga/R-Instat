export { EmbeddingService } from './embedding-service';
export type { EmbeddingHealthStatus } from './embedding-service';
export { VectorStoreService } from './vector-store';
export type { VectorStoreHealthStatus, VectorRecord, VectorSearchResult } from './vector-store';
export { registerVectorHandlers, triggerRSignatureIndexing } from './ipc-handlers';
