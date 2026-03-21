import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL || 'file:./dev.db';
  const dbPath = resolveDatabasePath(rawUrl);
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

function resolveDatabasePath(databaseUrl: string): string {
  if (databaseUrl.startsWith('file:')) {
    const [rawPath] = databaseUrl.slice('file:'.length).split('?');
    if (!rawPath) {
      throw new Error('DATABASE_URL must include a SQLite file path, e.g. file:./dev.db');
    }

    return path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(process.cwd(), rawPath);
  }

  // Backward compatibility for legacy plain paths in local .env files.
  return path.isAbsolute(databaseUrl)
    ? databaseUrl
    : path.resolve(process.cwd(), databaseUrl);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
