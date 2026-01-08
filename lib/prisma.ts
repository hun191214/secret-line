import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function ensurePrismaConnected(maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 단순 연결 대신 실제 쿼리로 연결 확인 (더 신뢰성 있음)
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error(`Prisma connection attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt < maxRetries) {
        // 재시도 전 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  return false;
}
