/**
 * R-Instat Preload Script
 * 
 * This script runs in the renderer process before the web content loads.
 * It uses contextBridge to safely expose selected APIs to the renderer.
 * 
 * Security: Only expose what's absolutely necessary.
 * @see https://www.electronjs.org/docs/latest/tutorial/context-isolation
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define the API that will be exposed to the renderer
const electronAPI = {
  // R Backend Communication
  r: {
    execute: (code: string): Promise<RResult> =>
      ipcRenderer.invoke('r:execute', code),

    validate: (code: string): Promise<RResult> =>
      ipcRenderer.invoke('r:validate', code),

    getDataframes: (): Promise<string[]> =>
      ipcRenderer.invoke('r:getDataframes'),
    
    getDataPreview: (name: string, limit?: number, offset?: number): Promise<DataPreview> => 
      ipcRenderer.invoke('r:getDataPreview', name, limit, offset),
    
    getColumns: (dataframe: string): Promise<string[]> => 
      ipcRenderer.invoke('r:getColumns', dataframe),
    
    getColumnTypes: (dataframe: string): Promise<Record<string, string>> => 
      ipcRenderer.invoke('r:getColumnTypes', dataframe),
    
    loadDemoData: (): Promise<RResult> => 
      ipcRenderer.invoke('r:loadDemoData'),
    
    listPackageDatasets: (): Promise<PackageDataset[]> => 
      ipcRenderer.invoke('r:listPackageDatasets'),
    
    loadPackageDataset: (packageName: string, dataset: string): Promise<RResult> => 
      ipcRenderer.invoke('r:loadPackageDataset', packageName, dataset),
    
    listInstatCollection: (): Promise<InstatCollectionDataset[]> => 
      ipcRenderer.invoke('r:listInstatCollection'),
    
    loadInstatCollectionDataset: (name: string, filePath: string): Promise<RResult> => 
      ipcRenderer.invoke('r:loadInstatCollectionDataset', name, filePath),
    
    importFile: (options: {
      path: string;
      name: string;
      separator?: string;
      decimal?: string;
      hasHeader?: boolean;
    }): Promise<RResult> =>
      ipcRenderer.invoke('r:importFile', options),
    
    status: (): Promise<RHealthStatus> => 
      ipcRenderer.invoke('r:status'),
    
    installPackages: (packages?: string[]): Promise<RResult> =>
      ipcRenderer.invoke('r:installPackages', packages),
    
    restart: (): Promise<void> =>
      ipcRenderer.invoke('r:restart'),
    
    onStatusChange: (callback: (status: RHealthStatus) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, status: RHealthStatus) => callback(status);
      ipcRenderer.on('r:statusChanged', handler);
      return () => {
        ipcRenderer.removeListener('r:statusChanged', handler);
      };
    },
  },

  // Menu event listeners
  onMenuCommand: (callback: (command: string, data?: unknown) => void): (() => void) => {
    const handlers = {
      import: (_event: IpcRendererEvent) => callback('import'),
      save: (_event: IpcRendererEvent) => callback('save'),
      about: (_event: IpcRendererEvent) => callback('about'),
      dialog: (_event: IpcRendererEvent, dialogName: string) => callback('dialog', dialogName),
    };

    ipcRenderer.on('menu:import', handlers.import);
    ipcRenderer.on('menu:save', handlers.save);
    ipcRenderer.on('menu:about', handlers.about);
    ipcRenderer.on('menu:dialog', handlers.dialog);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('menu:import', handlers.import);
      ipcRenderer.removeListener('menu:save', handlers.save);
      ipcRenderer.removeListener('menu:about', handlers.about);
      ipcRenderer.removeListener('menu:dialog', handlers.dialog);
    };
  },

  // Platform info
  platform: process.platform,

  // Dialog APIs
  dialog: {
    openFile: (options?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
      defaultPath?: string;
    }): Promise<{ canceled: boolean; filePaths: string[] }> =>
      ipcRenderer.invoke('dialog:openFile', options),
    
    saveFile: (options?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
      defaultPath?: string;
    }): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke('dialog:saveFile', options),
  },

  // App APIs
  app: {
    setLanguage: (lang: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('app:setLanguage', lang),
  },

  // AI provider APIs
  ai: {
    anthropicMessage: (request: {
      apiKey: string;
      system: string;
      userMessage: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
      timeoutMs?: number;
    }): Promise<{ ok: boolean; status: number; data: unknown }> =>
      ipcRenderer.invoke('ai:anthropicMessage', request),
    openaiChat: (request: {
      apiKey: string;
      system: string;
      userMessage: string;
      model?: string;
      temperature?: number;
      responseFormat?: 'json_object' | 'text';
      timeoutMs?: number;
    }): Promise<{ ok: boolean; status: number; data: unknown }> =>
      ipcRenderer.invoke('ai:openaiChat', request),
  },

  // File APIs for output export
  file: {
    writeText: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('file:writeText', filePath, content),
    
    writeBase64: (filePath: string, base64Data: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('file:writeBase64', filePath, base64Data),
  },
};

// Type definitions for the exposed API
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

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Note: TypeScript declaration for window.electronAPI is in src/app/electron.d.ts
// The preload script's declaration is internal to Electron's context
