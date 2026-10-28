import { prisma } from '../prisma/client';

async function main() {
  console.log('1. Adding UNIQUE constraint to head_ratings("departmentName", "ratingDate")...');
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'head_ratings_departmentName_ratingDate_key'
      ) THEN
        ALTER TABLE public.head_ratings
        ADD CONSTRAINT "head_ratings_departmentName_ratingDate_key"
        UNIQUE ("departmentName", "ratingDate");
      END IF;
    END $$;
  `);
  console.log('-> UNIQUE constraint added successfully.');

  console.log('2. Adding index on head_ratings("ratingDate")...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "head_ratings_ratingDate_idx"
    ON public.head_ratings USING btree ("ratingDate");
  `);

  console.log('3. Adding index on head_ratings("departmentName")...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "head_ratings_departmentName_idx"
    ON public.head_ratings USING btree ("departmentName");
  `);

  console.log('4. Adding UNIQUE constraint to admin_users("username")...');
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_username_key'
      ) THEN
        ALTER TABLE public.admin_users
        ADD CONSTRAINT "admin_users_username_key"
        UNIQUE ("username");
      END IF;
    END $$;
  `);

  console.log('5. Adding performance indexes on sync_jobs and audit_logs...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "sync_jobs_status_nextAttemptAt_idx"
    ON public.sync_jobs USING btree ("status", "nextAttemptAt");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "sync_jobs_entityType_entityId_idx"
    ON public.sync_jobs USING btree ("entityType", "entityId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"
    ON public.audit_logs USING btree ("action");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx"
    ON public.audit_logs USING btree ("entity");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx"
    ON public.audit_logs USING btree ("createdAt");
  `);

  console.log('\n--- VERIFYING head_ratings CONSTRAINTS & INDEXES ---');
  const constraints: any = await prisma.$queryRawUnsafe(`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'head_ratings'
    GROUP BY tc.constraint_name, tc.constraint_type;
  `);
  console.log('Constraints:', JSON.stringify(constraints, null, 2));

  const indexes: any = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'head_ratings';
  `);
  console.log('Indexes:', JSON.stringify(indexes, null, 2));
}

main()
  .catch((e) => {
    console.error('Error applying constraints:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
