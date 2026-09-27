import { prisma } from '../prisma/client';

async function clearSeedData() {
  console.log('🗑️  Clearing demo seed data...');
  
  // Delete in order respecting foreign key-like constraints
  await prisma.syncJob.deleteMany({});
  console.log('   ✅ sync_jobs cleared');
  
  await prisma.auditLog.deleteMany({});
  console.log('   ✅ audit_logs cleared');
  
  await prisma.headRating.deleteMany({});
  console.log('   ✅ head_ratings cleared');
  
  await prisma.dailyReport.deleteMany({});
  console.log('   ✅ daily_reports cleared');
  
  await prisma.employee.deleteMany({});
  console.log('   ✅ employees cleared');
  
  await prisma.department.deleteMany({});
  console.log('   ✅ departments cleared');
  
  // Keep admin_users (superadmin account)
  
  console.log('🎉 All demo data cleared. Ready for real data migration.');
  await prisma.$disconnect();
}

clearSeedData().catch(e => { console.error(e); process.exit(1); });
