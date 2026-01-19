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

  // Start R process
  rBridge.start().catch((err) => {
    console.error('Failed to start R:', err);
  });
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
