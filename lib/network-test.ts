/**
 * 네트워크 품질 테스트 유틸리티
 * Phase 3: 상담사 네트워크 게이트키퍼
 */

// 네트워크 테스트 결과 타입
export interface NetworkTestResult {
  ping: number;          // 지연 시간 (ms)
  downloadSpeed: number; // 다운로드 속도 (kbps)
  passed: boolean;       // 테스트 통과 여부
  pingPassed: boolean;   // Ping 테스트 통과
  speedPassed: boolean;  // 속도 테스트 통과
  error?: string;        // 에러 메시지 (있을 경우)
}

// 네트워크 품질 기준
export const NETWORK_REQUIREMENTS = {
  MAX_PING_MS: 300,         // 최대 허용 지연 시간 (ms)
  MIN_SPEED_KBPS: 500,      // 최소 다운로드 속도 (kbps)
  PING_TEST_ITERATIONS: 5,  // Ping 측정 반복 횟수
  SPEED_TEST_FILE_KB: 100,  // 속도 테스트 파일 크기 (KB)
};

/**
 * Ping(지연 시간) 측정
 * 서버에 여러 번 요청을 보내고 평균 RTT(Round-Trip Time)를 계산
 */
export async function measurePing(): Promise<number> {
  const results: number[] = [];
  
  for (let i = 0; i < NETWORK_REQUIREMENTS.PING_TEST_ITERATIONS; i++) {
    try {
      const startTime = performance.now();
      
      // 서버 Ping 엔드포인트 호출
      const response = await fetch('/api/counselor/network-test', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error('Ping request failed');
      }
      
      await response.json();
      const endTime = performance.now();
      const rtt = endTime - startTime;
      
      results.push(rtt);
    } catch (error) {
      console.error(`Ping test iteration ${i + 1} failed:`, error);
      // 실패한 테스트는 제외
    }
    
    // 테스트 간 짧은 간격
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (results.length === 0) {
    throw new Error('All ping tests failed');
  }
  
  // 최솟값과 최댓값을 제외한 평균 (변동성 줄이기)
  if (results.length >= 3) {
    results.sort((a, b) => a - b);
    const trimmed = results.slice(1, -1);
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  }
  
  // 결과가 적을 경우 단순 평균
  return Math.round(results.reduce((a, b) => a + b, 0) / results.length);
}

/**
 * 다운로드 속도 측정
 * 테스트 데이터를 다운로드하여 속도 계산
 */
export async function measureDownloadSpeed(): Promise<number> {
  try {
    const startTime = performance.now();
    
    // 테스트 데이터 다운로드 (서버에서 생성)
    const response = await fetch(`/api/counselor/network-test?download=true&size=${NETWORK_REQUIREMENTS.SPEED_TEST_FILE_KB}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    if (!response.ok) {
      throw new Error('Download test failed');
    }
    
    // 응답 데이터 읽기 (바이트 수 확인)
    const blob = await response.blob();
    const endTime = performance.now();
    
    // 속도 계산: bytes / seconds = bytes per second
    const durationSeconds = (endTime - startTime) / 1000;
    const bytesPerSecond = blob.size / durationSeconds;
    const kbps = Math.round((bytesPerSecond * 8) / 1000); // 비트로 변환 후 kbps
    
    return kbps;
  } catch (error) {
    console.error('Download speed test failed:', error);
    throw error;
  }
}

/**
 * 전체 네트워크 테스트 실행
 */
export async function runNetworkTest(): Promise<NetworkTestResult> {
  try {
    // 1. Ping 측정
    const ping = await measurePing();
    const pingPassed = ping <= NETWORK_REQUIREMENTS.MAX_PING_MS;
    
    // 2. 다운로드 속도 측정
    const downloadSpeed = await measureDownloadSpeed();
    const speedPassed = downloadSpeed >= NETWORK_REQUIREMENTS.MIN_SPEED_KBPS;
    
    // 3. 최종 결과
    const passed = pingPassed && speedPassed;
    
    return {
      ping,
      downloadSpeed,
      passed,
      pingPassed,
      speedPassed,
    };
  } catch (error: any) {
    console.error('Network test error:', error);
    
    return {
      ping: -1,
      downloadSpeed: -1,
      passed: false,
      pingPassed: false,
      speedPassed: false,
      error: error.message || 'Network test failed',
    };
  }
}

/**
 * 결과 포맷팅 (UI용)
 */
export function formatTestResult(result: NetworkTestResult): {
  pingDisplay: string;
  speedDisplay: string;
  pingStatus: 'good' | 'warning' | 'bad';
  speedStatus: 'good' | 'warning' | 'bad';
} {
  // Ping 상태 결정
  let pingStatus: 'good' | 'warning' | 'bad';
  if (result.ping < 0) {
    pingStatus = 'bad';
  } else if (result.ping <= 150) {
    pingStatus = 'good';
  } else if (result.ping <= NETWORK_REQUIREMENTS.MAX_PING_MS) {
    pingStatus = 'warning';
  } else {
    pingStatus = 'bad';
  }
  
  // 속도 상태 결정
  let speedStatus: 'good' | 'warning' | 'bad';
  if (result.downloadSpeed < 0) {
    speedStatus = 'bad';
  } else if (result.downloadSpeed >= 1000) {
    speedStatus = 'good';
  } else if (result.downloadSpeed >= NETWORK_REQUIREMENTS.MIN_SPEED_KBPS) {
    speedStatus = 'warning';
  } else {
    speedStatus = 'bad';
  }
  
  return {
    pingDisplay: result.ping >= 0 ? `${result.ping}ms` : '--',
    speedDisplay: result.downloadSpeed >= 0 ? `${result.downloadSpeed}kbps` : '--',
    pingStatus,
    speedStatus,
  };
}

