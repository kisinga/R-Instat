/**
 * R-Instat Electron Main Process
 * 
 * Following official Electron security best practices:
 * - contextIsolation: true
 * - nodeIntegration: false
 * - sandbox: true
 * - Preload script for safe API exposure
 * 
 * @see https://www.electronjs.org/docs/latest/tutorial/security
 */

import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { RBridge } from './r-bridge';
import { EmbeddingService, VectorStoreService, registerVectorHandlers } from './vector';

interface AnthropicMessageRequest {
  apiKey: string;
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}

interface OpenAIChatRequest {
  apiKey: string;
  system: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  timeoutMs?: number;
}

interface AIProxyResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

function isAbortLikeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'))
  );
}

function extractNetworkErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === 'string') return maybeCode;

  const maybeCause = (error as { cause?: unknown }).cause;
  if (typeof maybeCause === 'object' && maybeCause !== null) {
    const causeCode = (maybeCause as { code?: unknown }).code;
    if (typeof causeCode === 'string') return causeCode;
  }
  return undefined;
}

async function postJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<AIProxyResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = (await response.json()) as unknown;
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    const isTimeout = isAbortLikeError(error);
    const code = extractNetworkErrorCode(error);
    const status = isTimeout ? 408 : 599;
    const message = isTimeout
      ? `AI request timed out after ${timeoutMs}ms`
      : error instanceof Error
        ? error.message
        : 'Network request failed';

    console.error('[AI Bridge] Request failed', { url, status, code, message });
    return {
      ok: false,
      status,
      data: {
        error: {
          message,
          code: code ?? (isTimeout ? 'ETIMEDOUT' : 'NETWORK_ERROR'),
        },
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling
// This is only needed for Windows Squirrel installer
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed - ignore in development
}

let mainWindow: BrowserWindow | null = null;
let rBridge: RBridge | null = null;
let currentLanguage = 'en';
let translations: Record<string, unknown> = {};

// Determine if we're in development mode
const isDev = process.env['NODE_ENV'] === 'development' || !app.isPackaged;

/**
 * Load translations for the given language
 */
function loadTranslations(lang: string): Record<string, unknown> {
  try {
    // In dev mode, load from src/assets; in production from dist/browser/assets
    const basePath = isDev 
      ? path.join(__dirname, '../src/assets/i18n')
      : path.join(__dirname, '../dist/browser/assets/i18n');
    
    const filePath = path.join(basePath, `${lang}.json`);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
  }
  return {};
}

/**
 * Get a translation by key path (e.g., 'MENU.FILE')
 */
function t(key: string): string {
  const parts = key.split('.');
  let value: unknown = translations;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key; // Return key if translation not found
    }
  }
  
  return typeof value === 'string' ? value : key;
}

function createWindow(): void {
  // Load default translations
  translations = loadTranslations(currentLanguage);

  // Create the browser window with security-first configuration
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'R-Instat',
    backgroundColor: '#1e1e2e', // Match dark theme
    show: false, // Don't show until ready
    webPreferences: {
      // Security: Use preload script instead of nodeIntegration
      preload: path.join(__dirname, 'preload.js'),
      // Security: Isolate renderer from Node.js
      nodeIntegration: false,
      // Security: Enable context isolation (default since Electron 12)
      contextIsolation: true,
      // Security: Enable sandbox
      sandbox: true,
      // Security: Disable remote module
      // Performance: Enable hardware acceleration
      webgl: true,
    },
  });

  // Build the application menu with translations
  const menu = buildMenu();
  Menu.setApplicationMenu(menu);

  // Load the Angular app
  if (isDev) {
    // Development: load from Angular dev server
    mainWindow.loadURL('http://localhost:4200');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/browser/index.html'));
  }

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu(): Menu {
  // Minimal menu - all feature dialogs are accessed via Angular toolbar
  const template: Electron.MenuItemConstructorOptions[] = [
    // File menu - only Quit (OS-level)
    { role: 'fileMenu' },
    // Edit menu - native OS roles (Undo, Redo, Cut, Copy, Paste)
    { role: 'editMenu' },
    // View menu - native OS roles (Reload, Zoom, DevTools, Fullscreen)
    { role: 'viewMenu' },
    // Help menu
    {
      label: t('ELECTRON_MENU.HELP'),
      submenu: [
        {
          label: t('ELECTRON_MENU.ABOUT'),
          click: () => mainWindow?.webContents.send('menu:about'),
        },
        {
          label: t('ELECTRON_MENU.DOCUMENTATION'),
          click: () => shell.openExternal('https://r-instat.org/docs'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Set the application language and rebuild the menu
 */
function setLanguage(lang: string): void {
  currentLanguage = lang;
  translations = loadTranslations(lang);
  const menu = buildMenu();
  Menu.setApplicationMenu(menu);
}

// Initialize R Bridge and set up IPC handlers
function setupIPC(): void {
  rBridge = new RBridge();

  // Handle R commands from renderer
  ipcMain.handle('r:execute', async (_event, code: string) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.execute(code);
  });

  ipcMain.handle('r:validate', async (_event, code: string) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.validate(code);
  });

  ipcMain.handle('r:getDataframes', async () => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.getDataframes();
  });

  ipcMain.handle('r:getDataPreview', async (_event, name: string, limit?: number, offset?: number) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.getDataPreview(name, limit, offset);
  });

  ipcMain.handle('r:getColumns', async (_event, dataframe: string) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.getColumns(dataframe);
  });

  ipcMain.handle('r:getColumnTypes', async (_event, dataframe: string) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.getColumnTypes(dataframe);
  });

  ipcMain.handle('r:loadDemoData', async () => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.loadDemoData();
  });

  ipcMain.handle('r:listPackageDatasets', async () => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.listPackageDatasets();
  });

  ipcMain.handle('r:loadPackageDataset', async (_event, packageName: string, dataset: string) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.loadPackageDataset(packageName, dataset);
  });

  ipcMain.handle('r:listInstatCollection', async () => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.listInstatCollection();
  });

  ipcMain.handle('r:loadInstatCollectionDataset', async (_event, name: string, filePath: string) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.loadInstatCollectionDataset(name, filePath);
  });

  ipcMain.handle('r:importFile', async (_event, options: {
    path: string;
    name: string;
    separator?: string;
    decimal?: string;
    hasHeader?: boolean;
  }) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.importFile(options);
  });

  ipcMain.handle('r:status', async () => {
    if (!rBridge) return { status: 'error', error: 'R Bridge not initialized' };
    return rBridge.healthStatus;
  });

  ipcMain.handle('r:installPackages', async (_event, packages?: string[]) => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.installPackages(packages);
  });

  ipcMain.handle('r:restart', async () => {
    if (!rBridge) throw new Error('R Bridge not initialized');
    return rBridge.restart();
  });

  // Language change handler
  ipcMain.handle('app:setLanguage', async (_event, lang: string) => {
    setLanguage(lang);
    return { success: true };
  });

  // File dialog handlers
  ipcMain.handle('dialog:openFile', async (_event, options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    defaultPath?: string;
  }) => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options?.title || 'Select File',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: 'Data Files', extensions: ['csv', 'tsv', 'txt', 'xlsx', 'xls', 'rds', 'RDS'] },
        { name: 'CSV Files', extensions: ['csv', 'tsv', 'txt'] },
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'R Data Files', extensions: ['rds', 'RDS'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    
    return result;
  });

  ipcMain.handle('dialog:saveFile', async (_event, options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    defaultPath?: string;
  }) => {
    if (!mainWindow) return { canceled: true, filePath: undefined };
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options?.title || 'Save File',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'Excel Files', extensions: ['xlsx'] },
        { name: 'R Data Files', extensions: ['rds'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    
    return result;
  });

  // File write handlers for output export
  ipcMain.handle('file:writeText', async (_event, filePath: string, content: string) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Write failed' };
    }
  });

  ipcMain.handle('file:writeBase64', async (_event, filePath: string, base64Data: string) => {
    try {
      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      const base64Content = base64Data.includes(',') 
        ? base64Data.split(',')[1] 
        : base64Data;
      const buffer = Buffer.from(base64Content, 'base64');
      await fs.promises.writeFile(filePath, buffer);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Write failed' };
    }
  });

  // AI provider bridge (main process avoids renderer CORS restrictions)
  ipcMain.handle('ai:anthropicMessage', async (_event, request: AnthropicMessageRequest) => {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: request.userMessage },
    ];
    // Assistant prefill forces Claude to respond with JSON
    if (request.responseFormat === 'json') {
      messages.push({ role: 'assistant', content: '{' });
    }

    const result = await postJsonWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        'content-type': 'application/json',
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model: request.model ?? 'claude-haiku-4-5',
        max_tokens: request.maxTokens ?? 1800,
        temperature: request.temperature ?? 0.2,
        system: request.system,
        messages,
      },
      request.timeoutMs ?? 45000
    );

    // When using prefill, the response content doesn't include the prefilled "{",
    // so we prepend it to form valid JSON
    if (request.responseFormat === 'json' && result.ok && result.data) {
      const payload = result.data as { content?: Array<{ type?: string; text?: string }> };
      if (payload.content) {
        const textBlock = payload.content.find(c => c.type === 'text');
        if (textBlock?.text) {
          textBlock.text = '{' + textBlock.text;
        }
      }
    }

    return result;
  });

  ipcMain.handle('ai:openaiChat', async (_event, request: OpenAIChatRequest) => {
    return postJsonWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        'content-type': 'application/json',
        Authorization: `Bearer ${request.apiKey}`,
      },
      {
        model: request.model ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.userMessage },
        ],
        temperature: request.temperature ?? 0.2,
        ...(request.responseFormat === 'json_object'
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      },
      request.timeoutMs ?? 45000
    );
  });

  // Vector embedding + store services (optional, non-blocking)
  // Instantiate but don't start yet - services are lazy-initialized on first IPC call
  const embeddingService = new EmbeddingService();
  const vectorStore = new VectorStoreService();
  registerVectorHandlers(embeddingService, vectorStore);

  // Start R process
  rBridge.start().catch((err) => {
    console.error('Failed to start R:', err);
  });

  // Vector services start lazily on first use via IPC, not at app startup.
  // This avoids native module crashes blocking the app and defers the ~3s model load.
}

// App lifecycle
app.whenReady().then(() => {
  setupIPC();
  createWindow();

  // macOS: Re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    rBridge?.stop();
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  rBridge?.stop();
});
