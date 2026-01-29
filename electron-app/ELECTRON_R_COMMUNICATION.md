# Electron → R Communication Architecture

## Overview

This document explains the communication layer between Electron (Angular frontend) and the R backend process.

## Process Architecture

### Three Separate Processes

```
┌─────────────────────────────────────────────────────────────┐
│  Process 1: Renderer Process (Angular App)                 │
│  - Runs in sandboxed browser context                        │
│  - No direct Node.js access                                 │
│  - Communicates via IPC (Inter-Process Communication)       │
└──────────────────────┬──────────────────────────────────────┘
                       │ IPC (ipcRenderer.invoke)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Process 2: Main Process (Electron Main)                    │
│  - Node.js process with full system access                   │
│  - Single-threaded event loop                                │
│  - Spawns and manages R child process                       │
│  - Handles IPC from renderer                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ stdio (stdin/stdout)
                       │ JSON over pipes
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Process 3: R Process (bridge.R)                            │
│  - Separate child process spawned via child_process.spawn() │
│  - Runs Rscript with bridge.R script                        │
│  - Single-threaded R interpreter                            │
│  - Processes commands sequentially                           │
└─────────────────────────────────────────────────────────────┘
```

## What is IPC?

**IPC = Inter-Process Communication**

In Electron, IPC is the mechanism that allows the **renderer process** (your Angular app) to communicate with the **main process** (Node.js with system access).

### IPC Flow

1. **Renderer → Main**: `ipcRenderer.invoke('r:execute', code)`
   - Angular calls `window.electronAPI.r.execute(code)`
   - Preload script (`preload.ts`) exposes this via `contextBridge`
   - IPC message sent to main process

2. **Main → Renderer**: `ipcMain.handle('r:execute', async (event, code) => ...)`
   - Main process receives IPC message
   - Executes handler function
   - Returns Promise result back to renderer

### Security Model

- **Renderer process**: Sandboxed, no Node.js access (security)
- **Preload script**: Runs in isolated context, exposes safe API via `contextBridge`
- **Main process**: Full Node.js access, can spawn processes, access filesystem

## Is it Single-Threaded?

### Main Process (Node.js)
- **Yes, single-threaded** - Uses Node.js event loop
- **But**: Non-blocking I/O via async/await and Promises
- Multiple commands can be "in flight" simultaneously
- Commands are queued in the event loop, not blocked

### R Process
- **Yes, single-threaded** - R interpreter processes commands sequentially
- **But**: Commands are queued via stdin/stdout
- R processes one command at a time, but Node.js can queue multiple

### Key Point: Async but Sequential

```typescript
// Multiple commands can be sent:
await rBridge.execute('code1');  // Sent to R
await rBridge.execute('code2');  // Queued, waiting for code1
await rBridge.execute('code3');  // Queued, waiting for code2
```

R processes them **one at a time**, but Node.js doesn't block waiting - it uses Promises.

## Is it a Single Process?

**No!** There are **three separate processes**:

1. **Renderer Process**: Your Angular app (Chromium renderer)
2. **Main Process**: Electron main process (Node.js)
3. **R Process**: Child process spawned by main process

Each process has:
- Separate memory space
- Separate execution context
- Communication via IPC (renderer ↔ main) and stdio (main ↔ R)

## Command Execution Flow

### Step-by-Step Flow

```
┌──────────────┐
│ Angular App  │
│ (Renderer)   │
└──────┬───────┘
       │ 1. window.electronAPI.r.execute('print("Hello")')
       ▼
┌─────────────────────────────────────┐
│ Preload Script (preload.ts)         │
│ ipcRenderer.invoke('r:execute', ...)│
└──────┬──────────────────────────────┘
       │ 2. IPC Message
       ▼
┌─────────────────────────────────────┐
│ Main Process (main.ts)              │
│ ipcMain.handle('r:execute', ...)     │
│   → rBridge.execute(code)            │
└──────┬──────────────────────────────┘
       │ 3. rBridge.sendCommand()
       ▼
┌─────────────────────────────────────┐
│ R Bridge (r-bridge.ts)              │
│ - Generate unique command ID        │
│ - Store Promise in pending Map      │
│ - Write JSON to process.stdin       │
└──────┬──────────────────────────────┘
       │ 4. JSON over stdin pipe
       │    {"id":"cmd_1","type":"execute","code":"..."}
       ▼
┌─────────────────────────────────────┐
│ R Process (bridge.R)               │
│ - Read line from stdin              │
│ - Parse JSON command                │
│ - Execute R code                     │
│ - Write JSON response to stdout     │
└──────┬──────────────────────────────┘
       │ 5. JSON over stdout pipe
       │    {"id":"cmd_1","success":true,"result":...}
       ▼
┌─────────────────────────────────────┐
│ R Bridge (r-bridge.ts)              │
│ - Read from process.stdout           │
│ - Parse JSON response                │
│ - Match response.id to pending Map  │
│ - Resolve/reject Promise             │
└──────┬──────────────────────────────┘
       │ 6. Promise resolves
       ▼
┌─────────────────────────────────────┐
│ Main Process (main.ts)              │
│ Return result to IPC handler         │
└──────┬──────────────────────────────┘
       │ 7. IPC response
       ▼
┌─────────────────────────────────────┐
│ Preload Script (preload.ts)          │
│ Promise resolves                     │
└──────┬──────────────────────────────┘
       │ 8. Return to Angular
       ▼
┌──────────────┐
│ Angular App  │
│ Gets result  │
└──────────────┘
```

## Context Switching & Concurrency

### How Context Switching Works

**Node.js Event Loop (Main Process)**:
- Uses **non-blocking I/O** and **event-driven architecture**
- When you call `rBridge.execute()`, it:
  1. Creates a Promise
  2. Writes to stdin (non-blocking)
  3. Returns Promise immediately
  4. Event loop continues processing other events
  5. When R responds, stdout event fires
  6. Promise resolves with result

**Command Queue Management**:

```typescript
// r-bridge.ts
private pending: Map<string, PendingCommand> = new Map();

private async sendCommand(command: RCommandBase): Promise<RResponse> {
  const id = `cmd_${++this.commandId}`;
  const fullCommand: RCommand = { ...command, id };

  return new Promise((resolve, reject) => {
    // Store Promise callbacks in Map
    this.pending.set(id, { resolve, reject, timeout });
    
    // Write to stdin (non-blocking)
    const json = JSON.stringify(fullCommand) + '\n';
    this.process?.stdin?.write(json);
    // Function returns immediately - doesn't wait for R
  });
}
```

**Response Matching**:

```typescript
// When R responds via stdout:
private processBuffer(): void {
  const response = parsed as RResponse;
  const pending = this.pending.get(response.id);  // Match by ID
  if (pending) {
    pending.resolve(response);  // Resolve the Promise
    this.pending.delete(response.id);
  }
}
```

### Multiple Commands

**Scenario**: User sends 3 commands rapidly

```
Time →
┌─────────────────────────────────────────────────────────┐
│ Main Process (Node.js Event Loop)                        │
│                                                          │
│ T0: Command 1 sent to R stdin                          │
│     → Promise 1 created, stored in pending Map         │
│                                                          │
│ T1: Command 2 sent to R stdin                          │
│     → Promise 2 created, stored in pending Map         │
│                                                          │
│ T2: Command 3 sent to R stdin                          │
│     → Promise 3 created, stored in pending Map         │
│                                                          │
│ T3: Event loop continues (handles UI, other IPC, etc.) │
│                                                          │
│ T4: R responds to Command 1                            │
│     → Promise 1 resolves                                │
│                                                          │
│ T5: R responds to Command 2                            │
│     → Promise 2 resolves                                │
│                                                          │
│ T6: R responds to Command 3                            │
│     → Promise 3 resolves                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ R Process (Sequential Processing)                       │
│                                                          │
│ T0-T4: Processing Command 1                             │
│ T4-T5: Processing Command 2                             │
│ T5-T6: Processing Command 3                             │
└─────────────────────────────────────────────────────────┘
```

**Key Points**:
- Node.js can **queue** multiple commands (non-blocking)
- R processes them **sequentially** (one at a time)
- Each command has unique ID for request/response matching
- Promises allow async handling without blocking

## Buffer Management

The R Bridge uses a buffer to handle partial JSON messages:

```typescript
private buffer = '';

private processBuffer(): void {
  const lines = this.buffer.split('\n');
  this.buffer = lines.pop() || '';  // Keep incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as RResponse;
    // Process complete JSON message
  }
}
```

This handles cases where:
- R sends partial JSON (split across multiple stdout chunks)
- Multiple responses arrive in one chunk
- Network/pipe buffering delays

## Timeout Handling

Each command has a 30-second timeout:

```typescript
private readonly TIMEOUT_MS = 30000;

const timeout = setTimeout(() => {
  this.pending.delete(id);
  reject(new Error('R command timed out'));
}, this.TIMEOUT_MS);
```

If R doesn't respond within 30 seconds, the Promise rejects.

## Error Handling

1. **R Process Crashes**: 
   - `process.on('close')` fires
   - All pending commands are rejected
   - Health status updated

2. **R Command Fails**:
   - R returns `{"id":"cmd_1","success":false,"error":"..."}`
   - Promise rejects with error

3. **Parse Errors**:
   - Invalid JSON from R → logged, command rejected

## Summary

| Question | Answer |
|----------|--------|
| **Is it single-threaded?** | Main process: Yes (Node.js event loop). R process: Yes (sequential interpreter). But async/non-blocking. |
| **What is IPC?** | Inter-Process Communication - how renderer talks to main process in Electron. |
| **Is it a single process?** | No - 3 processes: Renderer (Angular), Main (Electron), R (child process). |
| **How are commands executed?** | Renderer → IPC → Main → stdio → R → stdio → Main → IPC → Renderer |
| **How is context switching handled?** | Node.js event loop queues commands. R processes sequentially. Promises + unique IDs match requests/responses. |

## Key Files

- `electron/main.ts`: Main process, IPC handlers
- `electron/preload.ts`: Exposes safe API to renderer
- `electron/r-bridge.ts`: Manages R child process, command queue
- `r-backend/bridge.R`: R script that processes commands
