const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const fs = require('fs');

// Ensure single running instance of the application
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Zero-dependency .env loader
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn('[Electron] Could not read env from:', filePath, err.message);
  }
}

// Load environment from all possible packaging locations
const envSearchPaths = [
  path.join(process.resourcesPath || '', '.env'),
  path.join(process.resourcesPath || '', 'server/.env'),
  path.join(process.resourcesPath || '', 'app.asar.unpacked/server/.env'),
  path.join(__dirname, '../server/.env'),
  path.join(__dirname, '../.env'),
];

for (const p of envSearchPaths) {
  loadEnvFile(p);
}

// Environment Defaults (Supabase Production Credentials)
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.jgckdllcffnzacacqjzp:8x.3wcN%2FV9Q9Yvf@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://postgres.jgckdllcffnzacacqjzp:8x.3wcN%2FV9Q9Yvf@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
process.env.SUPER_ADMIN_CODE = process.env.SUPER_ADMIN_CODE || 'TPC-SUPER-2026';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'the-prime-classes-super-secret-jwt-key-2026-branch-head';
process.env.MASTER_DB_SPREADSHEET_ID = process.env.MASTER_DB_SPREADSHEET_ID || '1AxdiOpaij8Lnx0TV5iMhgVlADfN0LeXzwOdmbzmrlGA';
process.env.APP_DB_SPREADSHEET_ID = process.env.APP_DB_SPREADSHEET_ID || '1IFGc0kvv9LpbZUfEGroY8PevevJ8axdPApVrLjidlw8';

let mainWindow = null;
let activePort = 5000;

// Dynamic port finder to prevent EADDRINUSE collisions
function findAvailablePort(startPort = 5000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      // If startPort is taken, let OS assign a guaranteed free port
      const fallbackServer = net.createServer();
      fallbackServer.unref();
      fallbackServer.listen(0, '127.0.0.1', () => {
        const port = fallbackServer.address().port;
        fallbackServer.close(() => resolve(port));
      });
    });

    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function checkServerHealthy(url, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Server health check timed out.'));
      } else {
        setTimeout(tryConnect, 300);
      }
    };

    tryConnect();
  });
}

let logPath = '';
function log(...args) {
  try {
    if (!logPath && app && app.getPath) {
      logPath = path.join(app.getPath('userData'), 'app.log');
    }
    if (logPath) {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${args.join(' ')}\n`);
    }
  } catch (_) {}
  console.log(...args);
}

process.on('uncaughtException', (err) => {
  log('[Electron] Uncaught Exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  log('[Electron] Unhandled Rejection:', reason);
});

function startBackendServer(port) {
  try {
    process.env.PORT = String(port);
    const potentialPaths = [
      path.join(__dirname, '../server/dist/index.js'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked/server/dist/index.js'),
      path.join(process.resourcesPath || '', 'server/dist/index.js'),
      path.join(process.resourcesPath || '', 'app/server/dist/index.js'),
    ];

    const serverPath = potentialPaths.find(p => {
      try { return fs.existsSync(p); } catch (_) { return false; }
    }) || potentialPaths[0];

    log(`[Electron] Starting internal backend on port ${port} from:`, serverPath);
    require(serverPath);
  } catch (err) {
    log('[Electron] Error starting internal server:', err && err.stack ? err.stack : err);
    try {
      dialog.showErrorBox('Internal Server Error', `Failed to start background server:\n${err.message}`);
    } catch (_) {}
  }
}

async function createWindow() {
  // Find guaranteed free port before starting backend
  activePort = await findAvailablePort(5000);
  log(`[Electron] Selected free port: ${activePort}`);

  startBackendServer(activePort);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    title: 'The Prime Classes - Branch Head & Super Admin',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Attach ready-to-show BEFORE loadURL so it catches the event as soon as first paint happens
  mainWindow.once('ready-to-show', () => {
    log('[Electron] ready-to-show fired, displaying window.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const serverUrl = `http://localhost:${activePort}`;

  try {
    log('[Electron] Waiting for server health check on', `${serverUrl}/health`);
    await checkServerHealthy(`${serverUrl}/health`, 15000);
    log('[Electron] Server is healthy! Loading URL...');
    await mainWindow.loadURL(serverUrl);
  } catch (e) {
    log('[Electron] Server health timeout or load error, attempting direct load...', e.message);
    try {
      await mainWindow.loadURL(serverUrl);
    } catch (loadErr) {
      log('[Electron] Failed to load server URL:', loadErr.message);
      try {
        dialog.showErrorBox(
          'Startup Error',
          `Failed to connect to internal application server on ${serverUrl}:\n${loadErr.message}\n\nPlease check your network connection or restart the application.`
        );
      } catch (_) {}
    }
  }

  // Safety fallback: ensure window is visible even if ready-to-show already fired or was missed
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    log('[Electron] Fallback: Window was not visible, showing now.');
    mainWindow.show();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle second instance launch
app.on('second-instance', () => {
  log('[Electron] Second instance launch detected, bringing window to front.');
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
