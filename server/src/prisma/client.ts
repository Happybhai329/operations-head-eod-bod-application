import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  // Ensure connection pool allows concurrent queries without timing out
  dbUrl = dbUrl.replace(/connection_limit=1(&|$)/g, 'connection_limit=10$1');
  if (!dbUrl.includes('connection_limit=')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=10';
  }
  if (!dbUrl.includes('pool_timeout=')) {
    dbUrl += '&pool_timeout=20';
  }
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

