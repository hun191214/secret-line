// Lite Mode 실체화: 오디오 비트레이트 최저, 애니메이션 시그널 생략
export function getLiteModeConfig(): { audioBitrate: number; skipAnimation: boolean } {
  return { audioBitrate: 24, skipAnimation: true };
}
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface NetworkQualityMetrics {
  latency: number; jitter: number; packetLoss: number; bandwidth: number; timestamp: number;
}

export enum NetworkQuality {
  EXCELLENT = 'EXCELLENT', GOOD = 'GOOD', FAIR = 'FAIR', POOR = 'POOR',
}

export interface NetworkValidationResult {
  passed: boolean; quality: NetworkQuality; metrics: NetworkQualityMetrics; message: string; recommendations?: string[];
}

export interface AdaptiveBitrateConfig {
  quality: NetworkQuality; audioBitrate: number; videoEnabled: boolean; sampleRate: number; channelCount: 1 | 2;
}

export interface CounselorStatusRequest {
  counselorId: string; targetStatus: 'IDLE' | 'BUSY' | 'OFFLINE'; networkMetrics?: NetworkQualityMetrics;
}

export class GatekeeperService {
  private prisma: PrismaClient;
  private redis: Redis;
  private readonly QUALITY_THRESHOLDS = { EXCELLENT: { latency: 100, jitter: 15 }, GOOD: { latency: 200, jitter: 30 }, FAIR: { latency: 300, jitter: 50 } };
  private readonly MIN_QUALITY_FOR_IDLE = NetworkQuality.GOOD;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
    });
    // 에러가 밖으로 튀지 않게 무조건 빈 함수로 잡아버림
    this.redis.on('error', () => {});
  }

  async validateNetworkQuality(counselorId: string, metrics: NetworkQualityMetrics): Promise<NetworkValidationResult> {
    const quality = this.calculateNetworkQuality(metrics);
    const passed = this.isQualityAcceptable(quality);
    await this.cacheNetworkMetrics(counselorId, metrics, quality);
    // 품질 미달 시 EVENT_NETWORK_GUIDE 소켓 이벤트 발송
    if (!passed) {
      // Socket.io 인스턴스 가져오기 (CallGateway 싱글턴)
      try {
        const { callGatewaySingleton } = await import('../call/call.gateway');
        if (callGatewaySingleton.server) {
          callGatewaySingleton.server.to(counselorId).emit('EVENT_NETWORK_GUIDE', {
            message: '현재 네트워크가 불안정합니다. Wi-Fi로 전환하거나 위치를 이동하여 품질을 개선해 주세요.'
          });
        }
      } catch (e) {
        // 소켓 서버 접근 실패 시 무시
      }
    }
    return { passed, quality, metrics, message: passed ? '품질 우수' : '품질 미달' };
  }

  private calculateNetworkQuality(metrics: NetworkQualityMetrics): NetworkQuality {
    const { latency, jitter } = metrics;
    if (latency < 100 && jitter < 15) return NetworkQuality.EXCELLENT;
    if (latency < 200 && jitter < 30) return NetworkQuality.GOOD;
    if (latency < 300 && jitter < 50) return NetworkQuality.FAIR;
    return NetworkQuality.POOR;
  }

  private isQualityAcceptable(quality: NetworkQuality): boolean {
    return [NetworkQuality.GOOD, NetworkQuality.EXCELLENT].includes(quality);
  }

  private async cacheNetworkMetrics(counselorId: string, metrics: any, quality: any) {
    await this.redis.setex(`network:${counselorId}`, 300, JSON.stringify({ metrics, quality, timestamp: Date.now() }));
  }

  getAdaptiveBitrateConfig(quality: NetworkQuality, isLiteMode: boolean = false): AdaptiveBitrateConfig {
    if (isLiteMode) return { quality: NetworkQuality.FAIR, audioBitrate: 24, videoEnabled: false, sampleRate: 16000, channelCount: 1 };
    if (quality === NetworkQuality.EXCELLENT) return { quality, audioBitrate: 128, videoEnabled: true, sampleRate: 48000, channelCount: 2 };
    return { quality: NetworkQuality.GOOD, audioBitrate: 64, videoEnabled: false, sampleRate: 48000, channelCount: 2 };
  }

  async updateCounselorStatusWithGatekeeper(request: CounselorStatusRequest) {
    const { counselorId, targetStatus, networkMetrics } = request;
    if (targetStatus === 'IDLE' && networkMetrics) {
      const validation = await this.validateNetworkQuality(counselorId, networkMetrics);
      if (!validation.passed) return { success: false, message: validation.message };
      await this.redis.setex(`counselor:status:${counselorId}`, 3600, 'IDLE');
      return { success: true, message: 'IDLE 전환 성공', quality: validation.quality };
    }
    await this.redis.setex(`counselor:status:${counselorId}`, 3600, targetStatus);
    return { success: true, message: `${targetStatus} 전환 완료` };
  }

  async setLiteMode(userId: string, enabled: boolean) {
    await this.prisma.user.update({ where: { id: userId }, data: { isLiteMode: enabled } });
  }

  async getLiteMode(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isLiteMode: true } });
    return user?.isLiteMode || false;
  }
}

export const gatekeeperService = new GatekeeperService();
