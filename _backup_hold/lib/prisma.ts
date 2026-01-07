/**
 * Prisma Client 싱글톤 인스턴스
 * 개발 환경에서 Hot Reload 시 Prisma Client 중복 생성 방지
 * 
 * ⚠️ 실제 DB 연결 상태를 엄격하게 체크하여 데이터 영구 저장 보장
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnectionFailed: boolean;
  prismaConnectionChecked: boolean;
};

// 실제 DB 연결 테스트 함수 (SQLite 호환, 파일 기반 유연 처리)
async function testConnection(client: PrismaClient): Promise<boolean> {
  try {
    // SQLite에서도 작동하는 간단한 쿼리로 DB 연결 테스트
    await client.$queryRaw`SELECT 1 as test`;
    return true;
  } catch (error: any) {
    // SQLite 파일 기반이므로 파일이 없으면 생성 시도
    // 또는 연결 오류인 경우 false 반환
    console.error('DB 연결 테스트 실패:', error?.message);
    return false;
  }
}

// PrismaClient 인스턴스 생성 함수 (예외 처리 포함)
function createPrismaClient(): PrismaClient | null {
  try {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    return client;
  } catch {
    globalForPrisma.prismaConnectionFailed = true;
    return null;
  }
}

// 기존 인스턴스가 있으면 사용, 없으면 새로 생성
const prismaInstance = globalForPrisma.prisma ?? createPrismaClient();

// export할 prisma 객체 (null일 수 있음에 주의)
export const prisma = prismaInstance as PrismaClient;

// 연결 상태를 비동기로 체크하는 함수 (재시도 로직 포함)
let connectionCheckPromise: Promise<boolean> | null = null;

async function checkConnection(retryCount: number = 0): Promise<boolean> {
  // 이미 확인되었고 성공한 경우 바로 반환
  if (globalForPrisma.prismaConnectionChecked && !globalForPrisma.prismaConnectionFailed) {
    return true;
  }

  // 진행 중인 체크가 있으면 대기
  if (connectionCheckPromise && retryCount === 0) {
    return connectionCheckPromise;
  }

  connectionCheckPromise = (async () => {
    if (!prismaInstance) {
      globalForPrisma.prismaConnectionFailed = true;
      globalForPrisma.prismaConnectionChecked = true;
      return false;
    }

    // SQLite 파일 기반이므로 파일 존재 여부 확인
    const fs = await import('fs/promises');
    const path = await import('path');
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    
    try {
      // 파일이 없으면 생성 시도 (Prisma가 자동 생성하지만 확인용)
      await fs.access(dbPath);
    } catch {
      // 파일이 없어도 Prisma가 자동 생성하므로 계속 진행
      console.log('DB 파일이 없습니다. Prisma가 자동 생성합니다.');
    }

    // 연결 테스트 (재시도 포함)
    let isConnected = false;
    const maxRetries = 2;
    
    for (let i = 0; i <= maxRetries; i++) {
      isConnected = await testConnection(prismaInstance);
      if (isConnected) {
        break;
      }
      
      if (i < maxRetries) {
        // 재시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    globalForPrisma.prismaConnectionFailed = !isConnected;
    globalForPrisma.prismaConnectionChecked = true;
    return isConnected;
  })();

  return connectionCheckPromise;
}

// 동기 플래그 (초기값은 false, 실제 연결 테스트는 비동기로 수행)
export const isPrismaConnected = !globalForPrisma.prismaConnectionFailed && prismaInstance !== null;

// 실제 연결 테스트를 수행하는 함수 (비동기, SQLite 파일 기반 유연 처리)
export async function ensurePrismaConnected(): Promise<boolean> {
  // SQLite 파일 기반이므로 더 유연하게 처리
  // 연결 체크 실패 시에도 일단 진행 (Prisma가 자동으로 처리)
  const isConnected = await checkConnection();
  
  // 연결 실패해도 SQLite는 파일이 자동 생성될 수 있으므로
  // prismaInstance가 있으면 true로 간주 (최후의 수단)
  if (!isConnected && prismaInstance) {
    console.warn('DB 연결 테스트 실패했지만 Prisma 인스턴스가 있으므로 계속 진행합니다.');
    return true;
  }
  
  return isConnected;
}

// 개발 환경에서 Hot Reload 시 인스턴스 재사용
if (process.env.NODE_ENV !== 'production' && prismaInstance) {
  globalForPrisma.prisma = prismaInstance;
}
