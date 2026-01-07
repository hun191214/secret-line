/**
 * 네트워크 테스트 API
 * GET /api/counselor/network-test - Ping 테스트 및 다운로드 속도 테스트
 * 
 * Phase 3: 상담사 네트워크 품질 게이트키퍼
 */

import { NextRequest, NextResponse } from 'next/server';

// 캐시 방지 헤더
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get('download') === 'true';
  const sizeKB = parseInt(searchParams.get('size') || '100');
  
  // 다운로드 속도 테스트 (테스트 데이터 전송)
  if (isDownload) {
    // 지정된 크기의 랜덤 데이터 생성 (최대 500KB로 제한)
    const actualSize = Math.min(sizeKB, 500) * 1024;
    const data = generateRandomData(actualSize);
    
    // Buffer를 Uint8Array로 변환하여 호환성 확보
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        ...noCacheHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Length': actualSize.toString(),
      },
    });
  }
  
  // Ping 테스트 (단순 응답)
  const timestamp = Date.now();
  
  return NextResponse.json({
    success: true,
    timestamp,
    message: 'pong',
  }, {
    status: 200,
    headers: noCacheHeaders,
  });
}

/**
 * 랜덤 바이너리 데이터 생성
 * 네트워크 속도 측정을 위한 테스트 페이로드
 */
function generateRandomData(bytes: number): Buffer {
  const buffer = Buffer.alloc(bytes);
  
  // 랜덤 데이터로 채우기 (압축 방지를 위해 랜덤 값 사용)
  for (let i = 0; i < bytes; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  
  return buffer;
}

