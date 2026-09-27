import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { SheetsSyncWorker } from './sheets/sheetsSyncWorker';
import { SheetsInboundSync } from './sheets/sheetsInboundSync';

export const app = express();

// Security and Logging Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline fonts/scripts needed by PDF tools if needed
}));
const allowedOrigin = env.CORS_ORIGIN;
app.use(cors({
  origin: allowedOrigin === '*' ? true : allowedOrigin,
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TPC Branch Head & Super Admin API',
    inboundSync: SheetsInboundSync.getStatus(),
  });
});

// API Routes
app.use('/api', routes);

// Serve Client Static Build in Production and Electron
const potentialClientPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(__dirname, './client-dist'),
  path.resolve(process.cwd(), 'client/dist'),
  typeof (process as any).resourcesPath === 'string' ? path.resolve((process as any).resourcesPath, 'client/dist') : '',
  typeof (process as any).resourcesPath === 'string' ? path.resolve((process as any).resourcesPath, 'app/client/dist') : '',
].filter(Boolean);

const clientDistPath = potentialClientPaths.find(p => fs.existsSync(p));
if (clientDistPath && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized Error Handler
app.use(errorHandler);

// Start server if run directly and not in test mode
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  const initialPort = parseInt(process.env.PORT || String(env.PORT) || '5000', 10);

  function startListening(port: number, attempt = 0): void {
    const server = app.listen(port, () => {
      process.env.PORT = String(port);
      console.log(`====================================================`);
      console.log(`🚀 The Prime Classes - Branch Head Full-Stack Server`);
      console.log(`🌐 Environment: ${env.NODE_ENV}`);
      console.log(`📡 REST API Live on: http://localhost:${port}`);
      console.log(`====================================================`);

      // Start background Outbox Google Sheets Sync Worker (Supabase → Sheets)
      SheetsSyncWorker.start();

      // Start Inbound Sync Worker (Sheets → Supabase) — pulls fresh data every 3 minutes
      SheetsInboundSync.start();
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && attempt < 10) {
        console.warn(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
        startListening(port + 1, attempt + 1);
      } else {
        console.error('💥 Fatal server listen error:', err);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('\n🛑 Shutting down server gracefully...');
      SheetsSyncWorker.stop();
      SheetsInboundSync.stop();
      server.close(() => {
        console.log('✅ Server terminated.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  startListening(initialPort);
}
