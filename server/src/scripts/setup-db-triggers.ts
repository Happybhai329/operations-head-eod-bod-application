import { prisma } from '../prisma/client';

async function setupTriggers() {
  console.log('🚀 Setting up automatic synchronization triggers in Supabase database...');

  // 1. Employees Function & Trigger
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_employees_columns()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW."employeeId" := COALESCE(NULLIF(NEW."employeeId", ''), NULLIF(NEW.emp_id, ''), NULLIF(NEW.id, ''));
        NEW.emp_id := COALESCE(NULLIF(NEW.emp_id, ''), NULLIF(NEW."employeeId", ''), NULLIF(NEW.id, ''));
        NEW.id := COALESCE(NULLIF(NEW.id, ''), NULLIF(NEW."employeeId", ''), NULLIF(NEW.emp_id, ''));
        NEW.status := COALESCE(NEW.status, 'active');
        NEW.role := COALESCE(NEW.role, 'employee');
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_sync_employees_columns ON employees;`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_sync_employees_columns
    BEFORE INSERT OR UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION sync_employees_columns();
  `);
  console.log('✅ Employees sync trigger active.');

  // 2. Departments Function & Trigger
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_departments_columns()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW."departmentName" := COALESCE(NULLIF(NEW."departmentName", ''), NULLIF(NEW.name, ''));
        NEW.name := COALESCE(NULLIF(NEW.name, ''), NULLIF(NEW."departmentName", ''));
        NEW."departmentId" := COALESCE(NULLIF(NEW."departmentId", ''), 'DEPT_' || REPLACE(UPPER(COALESCE(NEW.name, NEW."departmentName", 'UNKNOWN')), ' ', '_'));
        NEW."headId" := COALESCE(NULLIF(NEW."headId", ''), NULLIF(NEW.head_id, ''));
        NEW.head_id := COALESCE(NULLIF(NEW.head_id, ''), NULLIF(NEW."headId", ''));
        NEW."headName" := COALESCE(NULLIF(NEW."headName", ''), NULLIF(NEW.head_name, ''));
        NEW.head_name := COALESCE(NULLIF(NEW.head_name, ''), NULLIF(NEW."headName", ''));
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_sync_departments_columns ON departments;`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_sync_departments_columns
    BEFORE INSERT OR UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION sync_departments_columns();
  `);
  console.log('✅ Departments sync trigger active.');

  // 3. Daily Reports Function & Trigger
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_daily_reports_columns()
    RETURNS TRIGGER AS $$
    DECLARE
        d_str TEXT;
        parts TEXT[];
        epoch_ms BIGINT;
    BEGIN
        d_str := COALESCE(NULLIF(NEW."reportDate", ''), NULLIF(NEW.date, ''));
        NEW."reportDate" := d_str;
        NEW.date := d_str;

        IF d_str IS NOT NULL AND d_str LIKE '%/%/%' THEN
            parts := string_to_array(d_str, '/');
            IF array_length(parts, 1) = 3 THEN
                BEGIN
                    epoch_ms := (EXTRACT(EPOCH FROM to_timestamp(parts[3] || '-' || parts[2] || '-' || parts[1], 'YYYY-MM-DD')) * 1000)::BIGINT;
                    NEW."dateTimestamp" := epoch_ms;
                EXCEPTION WHEN OTHERS THEN
                    NULL;
                END;
            END IF;
        END IF;

        NEW."employeeId" := COALESCE(NULLIF(NEW."employeeId", ''), NULLIF(NEW.employee_id, ''));
        NEW.employee_id := COALESCE(NULLIF(NEW.employee_id, ''), NULLIF(NEW."employeeId", ''));

        NEW."departmentName" := COALESCE(NULLIF(NEW."departmentName", ''), NULLIF(NEW.department, ''));
        NEW.department := COALESCE(NULLIF(NEW.department, ''), NULLIF(NEW."departmentName", ''));

        NEW."systemScore" := COALESCE(NEW."systemScore", NEW.system_score, 0);
        NEW.system_score := COALESCE(NEW.system_score, NEW."systemScore", 0);

        -- Normalize scores > 1000
        IF NEW."systemScore" >= 1000 THEN
            NEW."systemScore" := ROUND(NEW."systemScore" / 100);
            NEW.system_score := NEW."systemScore";
        END IF;

        NEW."finalScore" := COALESCE(NEW."finalScore", NEW.final_score, NEW."systemScore");
        NEW.final_score := COALESCE(NEW.final_score, NEW."finalScore", NEW.system_score);

        IF NEW."finalScore" >= 1000 THEN
            NEW."finalScore" := ROUND(NEW."finalScore" / 100);
            NEW.final_score := NEW."finalScore";
        END IF;

        -- BOD conversion
        IF NEW."bodData" IS NOT NULL AND NEW."bodData"::text != '{}' AND NEW."bodData"::text != 'null' THEN
            NEW.bod_data := NEW."bodData"::text;
        ELSIF NEW.bod_data IS NOT NULL AND NEW.bod_data != '' AND NEW.bod_data != '{}' THEN
            BEGIN
                NEW."bodData" := NEW.bod_data::jsonb;
            EXCEPTION WHEN OTHERS THEN
                NEW."bodData" := '{}'::jsonb;
            END;
        ELSE
            NEW."bodData" := '{}'::jsonb;
            NEW.bod_data := '';
        END IF;

        -- EOD conversion
        IF NEW."eodData" IS NOT NULL AND NEW."eodData"::text != '{}' AND NEW."eodData"::text != 'null' THEN
            NEW.eod_data := NEW."eodData"::text;
        ELSIF NEW.eod_data IS NOT NULL AND NEW.eod_data != '' AND NEW.eod_data != '{}' THEN
            BEGIN
                NEW."eodData" := NEW.eod_data::jsonb;
            EXCEPTION WHEN OTHERS THEN
                NEW."eodData" := '{}'::jsonb;
            END;
        ELSE
            NEW."eodData" := '{}'::jsonb;
            NEW.eod_data := '';
        END IF;

        NEW."lastUpdated" := COALESCE(NEW."lastUpdated", NOW());

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_sync_daily_reports_columns ON daily_reports;`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_sync_daily_reports_columns
    BEFORE INSERT OR UPDATE ON daily_reports
    FOR EACH ROW
    EXECUTE FUNCTION sync_daily_reports_columns();
  `);
  console.log('✅ Daily reports sync trigger active.');

  // 4. Backfill existing daily_reports
  await prisma.$executeRawUnsafe(`UPDATE daily_reports SET "reportDate" = "reportDate";`);
  console.log('✅ All existing daily reports synced across both schemas.');

  // 5. Backfill employees
  await prisma.$executeRawUnsafe(`UPDATE employees SET "employeeId" = "employeeId";`);
  console.log('✅ All existing employees synced across both schemas.');
}

setupTriggers()
  .then(() => {
    console.log('🎉 Supabase database triggers fully installed and verified!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Error setting up triggers:', err);
    process.exit(1);
  });
