import { SheetsSyncWorker } from '../sheets/sheetsSyncWorker';
import { prisma } from '../prisma/client';

async function runSync() {
  console.log('🔄 Manually triggering Google Sheets Synchronization...');
  try {
    const stats = await SheetsSyncWorker.processPendingJobs();
    console.log(`✅ Sync cycle complete: ${stats.processed} jobs processed (${stats.succeeded} succeeded, ${stats.failed} failed)`);
  } catch (error) {
    console.error('❌ Error running manual sync:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runSync();
