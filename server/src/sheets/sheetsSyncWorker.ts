import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { GoogleSheetsClient } from './sheetsClient';
import { AuditService } from '../services/auditService';

export class SheetsSyncWorker {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  /**
   * Starts the background outbox polling loop.
   */
  public static start(): void {
    if (!env.SYNC_WORKER_ENABLED) {
      console.log('ℹ️ Google Sheets Sync Worker is disabled in configuration.');
      return;
    }

    if (this.timer) clearInterval(this.timer);

    console.log(`🚀 Starting Google Sheets Sync Worker (Interval: ${env.SYNC_POLL_INTERVAL_MS}ms)`);
    
    // Initial run after 2 seconds
    setTimeout(() => {
      this.processPendingJobs().catch((err) =>
        console.error('Error during initial sync pass:', err)
      );
    }, 2000);

    this.timer = setInterval(() => {
      this.processPendingJobs().catch((err) =>
        console.error('Error in sync worker cycle:', err)
      );
    }, env.SYNC_POLL_INTERVAL_MS);
  }

  /**
   * Stops the background outbox polling loop.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🛑 Stopped Google Sheets Sync Worker.');
    }
  }

  /**
   * Processes all pending Outbox jobs.
   */
  public static async processPendingJobs(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isRunning) return { processed: 0, succeeded: 0, failed: 0 };
    this.isRunning = true;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const now = new Date();

      // Find pending jobs that are ready for attempt
      const pendingJobs = await prisma.syncJob.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: now } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      if (pendingJobs.length === 0) {
        this.isRunning = false;
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      for (const job of pendingJobs) {
        processed++;

        // Mark as PROCESSING
        await prisma.syncJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSING', lastAttemptAt: new Date() },
        });

        try {
          if (job.entityType === 'HEAD_RATING') {
            const payload = job.payload as any;
            await GoogleSheetsClient.syncHeadRatingRow(env.APP_DB_SPREADSHEET_ID, payload);
          } else if (job.entityType === 'TASK_MAIN') {
            const payload = job.payload as any;
            await GoogleSheetsClient.syncTaskMainRow(env.APP_DB_SPREADSHEET_ID, payload);
          } else if (job.entityType === 'TASK_SUB') {
            const payload = job.payload as any;
            await GoogleSheetsClient.syncTaskSubRow(env.APP_DB_SPREADSHEET_ID, payload);
          } else if (job.entityType === 'TASK_CHECKLIST') {
            const payload = job.payload as any;
            await GoogleSheetsClient.syncChecklistItemRow(env.APP_DB_SPREADSHEET_ID, payload);
          } else if (job.entityType === 'TASK_ATTACHMENT') {
            const payload = job.payload as any;
            await GoogleSheetsClient.syncTaskAttachmentRow(env.APP_DB_SPREADSHEET_ID, payload);
          } else if (job.entityType === 'TASK_REMARK') {
            const payload = job.payload as any;
            await GoogleSheetsClient.syncTaskRemarkRow(env.APP_DB_SPREADSHEET_ID, payload);
          } else if (job.entityType === 'DAILY_REPORT') {
            const payload = job.payload as any;
            await GoogleSheetsClient.syncDailyReportRow(env.APP_DB_SPREADSHEET_ID, payload);
          }

          // Mark COMPLETED
          await prisma.syncJob.update({
            where: { id: job.id },
            data: {
              status: 'COMPLETED',
              error: null,
              updatedAt: new Date(),
            },
          });

          await AuditService.log({
            actor: 'SYNC_WORKER',
            action: 'SYNC_JOB_SUCCESS',
            entity: job.entityType,
            entityId: job.entityId,
            metadata: { jobId: job.id, attempts: job.attempts + 1 },
          });

          succeeded++;
        } catch (err: any) {
          failed++;
          const nextAttempts = job.attempts + 1;
          const isFinalFailure = nextAttempts >= job.maxAttempts;
          const backoffDelayMs = Math.pow(2, nextAttempts) * 1000; // Exponential backoff: 2s, 4s, 8s, 16s...
          const nextAttemptAt = new Date(Date.now() + backoffDelayMs);

          await prisma.syncJob.update({
            where: { id: job.id },
            data: {
              status: isFinalFailure ? 'FAILED' : 'PENDING',
              attempts: nextAttempts,
              nextAttemptAt: isFinalFailure ? null : nextAttemptAt,
              error: err.message || String(err),
              updatedAt: new Date(),
            },
          });

          await AuditService.log({
            actor: 'SYNC_WORKER',
            action: isFinalFailure ? 'SYNC_JOB_MAX_FAILURES' : 'SYNC_JOB_RETRY',
            entity: job.entityType,
            entityId: job.entityId,
            metadata: {
              jobId: job.id,
              attempts: nextAttempts,
              error: err.message,
              nextAttemptAt: nextAttemptAt.toISOString(),
            },
          });

          console.warn(
            `⚠️ Sync job ${job.id} (${job.entityType} ${job.entityId}) failed (Attempt ${nextAttempts}/${job.maxAttempts}): ${err.message}`
          );
        }
      }
    } catch (outerError) {
      console.error('💥 Fatal error in sync worker pass:', outerError);
    } finally {
      this.isRunning = false;
    }

    return { processed, succeeded, failed };
  }
}
