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
    columns?: string[];
    totalRows?: number;
  };
  error?: string;
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

interface ElectronAPI {
  r: {
    execute: (code: string) => Promise<RResult>;
    getDataframes: () => Promise<string[]>;
    getDataPreview: (name: string, limit?: number, offset?: number) => Promise<DataPreview>;
    getColumns: (dataframe: string) => Promise<string[]>;
    getColumnTypes: (dataframe: string) => Promise<Record<string, string>>;
    loadDemoData: () => Promise<RResult>;
    listPackageDatasets: () => Promise<PackageDataset[]>;
    loadPackageDataset: (packageName: string, dataset: string) => Promise<RResult>;
    listInstatCollection: () => Promise<InstatCollectionDataset[]>;
    loadInstatCollectionDataset: (name: string, filePath: string) => Promise<RResult>;
    status: () => Promise<RHealthStatus>;
    installPackages: (packages?: string[]) => Promise<RResult>;
    restart: () => Promise<void>;
    onStatusChange: (callback: (status: RHealthStatus) => void) => () => void;
  };
  dialog: {
    openFile: (options?: FileDialogOptions) => Promise<FileDialogResult>;
  };
  app: {
    setLanguage: (lang: string) => Promise<{ success: boolean }>;
  };
  onMenuCommand: (callback: (command: string, data?: unknown) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
