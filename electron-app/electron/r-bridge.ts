/**
 * R Bridge - Manages communication with R process
 * 
 * Uses child_process to spawn R and communicates via JSON over stdio.
 * This approach is simpler than HTTP for desktop apps and avoids port conflicts.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { RCommand, RCommandBase, RResponse, RReadySignal, PendingCommand, DataPreview } from './types';
import { extractStringArray } from './utils/response-utils';

export class RBridge {
  private process: ChildProcess | null = null;
  private pending: Map<string, PendingCommand> = new Map();
  private buffer = '';
  private connected = false;
  private commandId = 0;
  private readonly TIMEOUT_MS = 30000; // 30 seconds

  /**
   * Find R executable path based on platform
   */
  private findRPath(): string {
    const platform = process.platform;
    
    // Check common R installation paths
    const paths: string[] = [];
    
    if (platform === 'win32') {
      // Windows paths
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      
      // Check for R versions 4.x
      for (let minor = 4; minor >= 0; minor--) {
        for (let patch = 3; patch >= 0; patch--) {
          paths.push(path.join(programFiles, 'R', `R-4.${minor}.${patch}`, 'bin', 'Rscript.exe'));
          paths.push(path.join(programFilesX86, 'R', `R-4.${minor}.${patch}`, 'bin', 'Rscript.exe'));
        }
      }
      paths.push('Rscript.exe'); // Try PATH
    } else if (platform === 'darwin') {
      // macOS paths
      paths.push('/usr/local/bin/Rscript');
      paths.push('/opt/homebrew/bin/Rscript');
      paths.push('/Library/Frameworks/R.framework/Resources/bin/Rscript');
      paths.push('Rscript'); // Try PATH
    } else {
      // Linux paths
      paths.push('/usr/bin/Rscript');
      paths.push('/usr/local/bin/Rscript');
      paths.push('Rscript'); // Try PATH
    }

    // Find first existing path
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          return p;
        }
      } catch {
        // Path doesn't exist, try next
      }
    }

    // Default to PATH lookup
    return 'Rscript';
  }

  /**
   * Get path to R backend bridge script
   */
  private getBridgeScriptPath(): string {
    if (app.isPackaged) {
      // Production: in resources folder
      return path.join(process.resourcesPath, 'r-backend', 'bridge.R');
    } else {
      // Development: relative to project
      return path.join(__dirname, '..', 'r-backend', 'bridge.R');
    }
  }

  /**
   * Start the R process
   */
  async start(): Promise<void> {
    if (this.process) {
      console.log('R process already running');
      return;
    }

    const rPath = this.findRPath();
    const bridgePath = this.getBridgeScriptPath();

    console.log(`Starting R: ${rPath}`);
    console.log(`Bridge script: ${bridgePath}`);

    // Check if bridge script exists
    if (!fs.existsSync(bridgePath)) {
      throw new Error(`R bridge script not found: ${bridgePath}`);
    }

    // Get the directory containing the bridge script
    const bridgeDir = path.dirname(bridgePath);

    this.process = spawn(rPath, ['--no-save', '--no-restore', '--no-site-file', bridgePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: bridgeDir, // Set working directory to where bridge.R is
      env: {
        ...process.env,
        // Pass demo data path to R
        RINSTAT_DEMO_DATA: app.isPackaged
          ? path.join(process.resourcesPath, 'demo-data')
          : path.join(__dirname, '..', 'assets', 'demo-data'),
        // Pass instat collection path to R
        RINSTAT_COLLECTION_PATH: app.isPackaged
          ? path.join(process.resourcesPath, 'instat-collection')
          : path.join(__dirname, '..', 'assets', 'instat-collection'),
      },
    });

    // Handle stdout (JSON responses)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (R messages/errors for logging)
    this.process.stderr?.on('data', (data: Buffer) => {
      console.log('[R]', data.toString().trim());
    });

    // Handle process exit
    this.process.on('close', (code) => {
      console.log(`R process exited with code ${code}`);
      this.connected = false;
      this.process = null;
      
      // Reject all pending commands
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('R process exited'));
        this.pending.delete(id);
      }
    });

    this.process.on('error', (err) => {
      console.error('R process error:', err);
      this.connected = false;
    });

    // Wait for R to be ready
    await this.waitForReady();
  }

  /**
   * Wait for R process to signal it's ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('R process failed to start within timeout'));
      }, 10000);

      const checkReady = () => {
        if (this.connected) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      // R bridge sends a ready signal on startup
      const readyHandler = (data: Buffer) => {
        const text = data.toString();
        if (text.includes('"ready":true')) {
          this.connected = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      this.process?.stdout?.once('data', readyHandler);
      checkReady();
    });
  }

  /**
   * Process the buffer for complete JSON messages
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const parsed = JSON.parse(line) as RResponse | RReadySignal;
        
        // Check for ready signal (startup message)
        if ('ready' in parsed) {
          this.connected = true;
          continue;
        }

        // It's a command response
        const response = parsed as RResponse;
        if (!response.id) {
          console.warn('[RBridge] Response missing id:', line);
          continue;
        }

        const pending = this.pending.get(response.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(response);
          this.pending.delete(response.id);
        }
      } catch (e) {
        console.error('Failed to parse R response:', line, e);
      }
    }
  }

  /**
   * Send a command to R and wait for response
   */
  private async sendCommand(command: RCommandBase): Promise<RResponse> {
    if (!this.process || !this.connected) {
      throw new Error('R process not connected');
    }

    const id = `cmd_${++this.commandId}`;
    const fullCommand: RCommand = { ...command, id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('R command timed out'));
      }, this.TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timeout });

      const json = JSON.stringify(fullCommand) + '\n';
      this.process?.stdin?.write(json);
    });
  }

  /**
   * Execute arbitrary R code
   */
  async execute(code: string): Promise<RResponse> {
    return this.sendCommand({ type: 'execute', code });
  }

  /**
   * Get list of dataframe names
   */
  async getDataframes(): Promise<string[]> {
    const response = await this.sendCommand({ type: 'get_dataframes' });
    return extractStringArray(response);
  }

  /**
   * Get data preview for a dataframe with pagination
   */
  async getDataPreview(name: string, limit = 100, offset = 0): Promise<{
    columns: string[];
    columnTypes: Record<string, string>;
    rows: Record<string, unknown>[];
    totalRows: number;
    offset: number;
    limit: number;
  }> {
    const response = await this.sendCommand({ 
      type: 'get_data_preview', 
      name, 
      limit,
      offset
    });
    
    if (response.success && response.result) {
      return response.result as {
        columns: string[];
        columnTypes: Record<string, string>;
        rows: Record<string, unknown>[];
        totalRows: number;
        offset: number;
        limit: number;
      };
    }
    
    throw new Error(response.error || 'Failed to get data preview');
  }

  /**
   * Get column names for a dataframe
   */
  async getColumns(dataframe: string): Promise<string[]> {
    const response = await this.sendCommand({ 
      type: 'get_columns', 
      name: dataframe 
    });
    return extractStringArray(response);
  }

  /**
   * Get column types for a dataframe
   */
  async getColumnTypes(dataframe: string): Promise<Record<string, string>> {
    const response = await this.sendCommand({ 
      type: 'get_column_types', 
      name: dataframe 
    });
    
    if (response.success && response.result) {
      return response.result as Record<string, string>;
    }
    return {};
  }

  /**
   * Load demo dataset
   */
  async loadDemoData(): Promise<RResponse> {
    return this.sendCommand({ type: 'load_demo' });
  }

  /**
   * List datasets available from installed R packages
   */
  async listPackageDatasets(): Promise<{ package: string; name: string; title: string }[]> {
    const response = await this.sendCommand({ type: 'list_package_datasets' });
    
    if (response.success && response.result) {
      const result = response.result as { datasets: { package: string; name: string; title: string }[] };
      return result.datasets || [];
    }
    
    throw new Error(response.error || 'Failed to list package datasets');
  }

  /**
   * Load a specific dataset from an R package
   */
  async loadPackageDataset(packageName: string, dataset: string): Promise<RResponse> {
    return this.sendCommand({ 
      type: 'load_package_dataset',
      package: packageName,
      dataset
    });
  }

  /**
   * List datasets from Instat collection folder
   */
  async listInstatCollection(): Promise<{ name: string; filename: string; path: string; title: string; format: string }[]> {
    const response = await this.sendCommand({ type: 'list_instat_collection' });
    
    if (response.success && response.result) {
      const result = response.result as { datasets: { name: string; filename: string; path: string; title: string; format: string }[] };
      return result.datasets || [];
    }
    
    throw new Error(response.error || 'Failed to list Instat collection');
  }

  /**
   * Load a dataset from Instat collection
   */
  async loadInstatCollectionDataset(name: string, filePath: string): Promise<RResponse> {
    return this.sendCommand({ 
      type: 'load_instat_collection_dataset',
      name,
      path: filePath
    });
  }

  /**
   * Check if R is connected
   */
  isConnected(): boolean {
    return this.connected && this.process !== null;
  }

  /**
   * Stop the R process
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
    }
  }
}
