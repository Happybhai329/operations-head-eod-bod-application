import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { SheetsSyncWorker } from '../sheets/sheetsSyncWorker';
import { SheetsInboundSync } from '../sheets/sheetsInboundSync';

export class SyncController {
  public static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let pendingCount = 0;
      let processingCount = 0;
      let completedCount = 0;
      let failedCount = 0;
      let latestJob: any = null;

      try {
        const [p, pr, c, f, lj] = await Promise.all([
          prisma.syncJob.count({ where: { status: 'PENDING' } }),
          prisma.syncJob.count({ where: { status: 'PROCESSING' } }),
          prisma.syncJob.count({ where: { status: 'COMPLETED' } }),
          prisma.syncJob.count({ where: { status: 'FAILED' } }),
          prisma.syncJob.findFirst({ orderBy: { updatedAt: 'desc' } }),
        ]);
        pendingCount = p;
        processingCount = pr;
        completedCount = c;
        failedCount = f;
        latestJob = lj;
      } catch (dbErr) {
        // Database offline or starting up
      }

      const inboundStatus = SheetsInboundSync.getStatus();

      res.status(200).json({
        success: true,
        data: {
          outbox: {
            pending: pendingCount,
            processing: processingCount,
            completed: completedCount,
            failed: failedCount,
            lastSyncedAt: latestJob?.updatedAt || null,
            lastError: latestJob?.status === 'FAILED' ? latestJob.error : null,
          },
          inbound: {
            enabled: inboundStatus.enabled,
            lastSync: inboundStatus.lastSync,
            intervalMs: inboundStatus.intervalMs,
            isRunning: inboundStatus.isRunning,
          },
          // Backward compat flat fields
          pending: pendingCount,
          processing: processingCount,
          completed: completedCount,
          failed: failedCount,
          lastSyncedAt: latestJob?.updatedAt || null,
          lastError: latestJob?.status === 'FAILED' ? latestJob.error : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger outbound sync (Supabase → Google Sheets).
   */
  public static async triggerSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Re-queue any FAILED jobs so manual sync retry attempts them
      await prisma.syncJob.updateMany({
        where: { status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, nextAttemptAt: null, error: null },
      });

      const stats = await SheetsSyncWorker.processPendingJobs();
      res.status(200).json({
        success: true,
        message: 'Outbound sync pass triggered successfully.',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger inbound sync (Google Sheets → Supabase).
   * This pulls the latest data from Google Sheets into the database immediately.
   */
  public static async triggerInboundSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await SheetsInboundSync.syncAll();
      res.status(200).json({
        success: true,
        message: 'Inbound sync from Google Sheets completed.',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}
