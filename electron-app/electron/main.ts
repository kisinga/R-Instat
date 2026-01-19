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

// Determine if we're in development mode
const isDev = process.env['NODE_ENV'] === 'development' || !app.isPackaged;

function createWindow(): void {
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

  // Build the application menu
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
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Data...',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow?.webContents.send('menu:dialog', 'import'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'Data',
      submenu: [
        {
          label: 'Filter...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'filter'),
        },
        {
          label: 'Sort...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'sort'),
        },
        { type: 'separator' },
        {
          label: 'Calculate...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'calculate'),
        },
        {
          label: 'Recode...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'recode'),
        },
        {
          label: 'Rename Column...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'rename'),
        },
      ],
    },
    {
      label: 'Describe',
      submenu: [
        {
          label: 'Describe Data...',
          accelerator: 'CmdOrCtrl+D',
          click: () => mainWindow?.webContents.send('menu:dialog', 'describe'),
        },
        { type: 'separator' },
        {
          label: 'Quick Summary...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'describe:summary'),
        },
        {
          label: 'Quick Graph...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'describe:graph'),
        },
        { type: 'separator' },
        {
          label: 'Specific Graphs',
          submenu: [
            {
              label: 'Histogram...',
              click: () => mainWindow?.webContents.send('menu:dialog', 'histogram'),
            },
            {
              label: 'Box Plot...',
              click: () => mainWindow?.webContents.send('menu:dialog', 'boxplot'),
            },
            {
              label: 'Scatter Plot...',
              click: () => mainWindow?.webContents.send('menu:dialog', 'scatter'),
            },
            {
              label: 'Bar Chart...',
              click: () => mainWindow?.webContents.send('menu:dialog', 'bar-chart'),
            },
          ],
        },
      ],
    },
    {
      label: 'Model',
      submenu: [
        {
          label: 'Correlation...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'correlation'),
        },
        {
          label: 't-Test...',
          click: () => mainWindow?.webContents.send('menu:dialog', 't-test'),
        },
        {
          label: 'Linear Regression...',
          click: () => mainWindow?.webContents.send('menu:dialog', 'regression'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About R-Instat',
          click: () => mainWindow?.webContents.send('menu:about'),
        },
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://r-instat.org/docs'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
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
    if (!rBridge) return { connected: false };
    return { connected: rBridge.isConnected() };
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
