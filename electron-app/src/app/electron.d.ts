/**
 * TypeScript declarations for Electron API exposed via preload
 */

interface RResult {
  success: boolean;
  result?: {
    type: 'text' | 'dataframe' | 'plot' | 'error';
    value?: string | string[];
    data?: Record<string, unknown>[];
    path?: string;
    dataUrl?: string; // Base64 encoded image data URL for plots
    columns?: string[];
    totalRows?: number;
  };
  error?: string;
  errorType?: 'syntax' | 'runtime';
}

interface DataPreview {
  columns: string[];
  columnTypes: Record<string, string>;
  rows: Record<string, unknown>[];
  totalRows: number;
  offset: number;
  limit: number;
}

interface PackageDataset {
  package: string;
  name: string;
  title: string;
}

interface InstatCollectionDataset {
  name: string;
  filename: string;
  path: string;
  title: string;
  format: string;
}

type RHealthStatusType = 'starting' | 'missing_packages' | 'installing' | 'ready' | 'error';

interface RHealthStatus {
  status: RHealthStatusType;
  missingPackages?: string[];
  installProgress?: {
    current: number;
    total: number;
    package: string;
  };
  error?: string;
}

interface FileDialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
}

interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

interface StructuredPlanRequest {
  provider: 'openai' | 'claude';
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface RawChatRequest {
  provider: 'openai' | 'claude';
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  responseFormat: 'json' | 'text';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface ElectronAPI {
  r: {
    execute: (code: string) => Promise<RResult>;
    validate: (code: string) => Promise<RResult>;
    getDataframes: () => Promise<string[]>;
    getDataPreview: (name: string, limit?: number, offset?: number) => Promise<DataPreview>;
    getColumns: (dataframe: string) => Promise<string[]>;
    getColumnTypes: (dataframe: string) => Promise<Record<string, string>>;
    loadDemoData: () => Promise<RResult>;
    listPackageDatasets: () => Promise<PackageDataset[]>;
    loadPackageDataset: (packageName: string, dataset: string) => Promise<RResult>;
    listInstatCollection: () => Promise<InstatCollectionDataset[]>;
    loadInstatCollectionDataset: (name: string, filePath: string) => Promise<RResult>;
    importFile: (options: {
      path: string;
      name: string;
      separator?: string;
      decimal?: string;
      hasHeader?: boolean;
    }) => Promise<RResult>;
    status: () => Promise<RHealthStatus>;
    installPackages: (packages?: string[]) => Promise<RResult>;
    restart: () => Promise<void>;
    onStatusChange: (callback: (status: RHealthStatus) => void) => () => void;
  };
  dialog: {
    openFile: (options?: FileDialogOptions) => Promise<FileDialogResult>;
    saveFile: (options?: FileDialogOptions) => Promise<SaveDialogResult>;
  };
  app: {
    setLanguage: (lang: string) => Promise<{ success: boolean }>;
  };
  ai: {
    structuredPlan: (request: StructuredPlanRequest) => Promise<{ ok: boolean; plan?: unknown; error?: string }>;
    rawChat: (request: RawChatRequest) => Promise<{ ok: boolean; content?: string; error?: string }>;
  };
  file: {
    readText: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeText: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    writeBase64: (filePath: string, base64Data: string) => Promise<{ success: boolean; error?: string }>;
  };
  vector?: {
    status: () => Promise<{ embedding: unknown; vectorStore: unknown }>;
    indexDialogs: (contracts: VectorDialogContract[]) => Promise<{ indexed: number }>;
    searchDialogs: (query: string, topK: number, family?: string) => Promise<VectorSearchResult[]>;
    storeInteraction: (interaction: VectorInteractionRecord) => Promise<{ stored: boolean }>;
    searchInteractions: (query: string, topK: number) => Promise<VectorSearchResult[]>;
    searchRSignatures: (query: string, topK: number) => Promise<VectorSearchResult[]>;
    tableInfo: (table: string) => Promise<{ exists: boolean; rowCount: number }>;
    hydrateRSignatures: () => Promise<{ indexed: number }>;
  };
  onMenuCommand: (callback: (command: string, data?: unknown) => void) => () => void;
  platform: string;
}

interface VectorDialogContract {
  dialogId: string;
  description: string;
  family: string;
  operations: string[];
  keywords: string[];
  paramNames: string[];
}

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface VectorInteractionRecord {
  id: string;
  query: string;
  dialogId: string;
  operationId?: string;
  state: string;
  success: boolean;
  executionMode?: string;
  confidence?: number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
