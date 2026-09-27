import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or server folder
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.union([z.string(), z.number()]).default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/tpc_branch_head_db?schema=public'),
  
  SUPER_ADMIN_CODE: z.string().default('TPC-SUPER-2026'),
  SUPER_ADMIN_USERNAME: z.string().default('superadmin'),
  SUPER_ADMIN_PASSWORD_HASH: z.string().optional(),
  
  JWT_SECRET: z.string().default('the-prime-classes-super-secret-jwt-key-2026-branch-head'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  MASTER_DB_SPREADSHEET_ID: z.string().default('1AxdiOpaij8Lnx0TV5iMhgVlADfN0LeXzwOdmbzmrlGA'),
  APP_DB_SPREADSHEET_ID: z.string().default('1IFGc0kvv9LpbZUfEGroY8PevevJ8axdPApVrLjidlw8'),
  
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CREDENTIALS_PATH: z.string().optional(),
  GOOGLE_CREDENTIALS_JSON: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  
  SYNC_WORKER_ENABLED: z.string().default('true').transform(v => v === 'true'),
  SYNC_POLL_INTERVAL_MS: z.string().default('5000').transform(Number),
  SYNC_MAX_RETRIES: z.string().default('5').transform(Number),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
