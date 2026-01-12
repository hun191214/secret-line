import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import { PrismaClient } from '@prisma/client';
import { profitService } from '../profit/profit.service';
import { userService } from '../user/user.service';
import redisClient from '../../utils/redis';

/**
 * Agora 토큰 생성 파라미터
 */
export interface AgoraTokenParams {
  channelName: string;
  userId: string;
  role?: 'publisher' | 'subscriber';
  expirationTimeInSeconds?: number;
}

/**
 * 통화 접근 검증 결과
 */
export interface CallAccessValidation {
  allowed: boolean;
  reason?: string;
  userBalance: number;
  requiredBalance: number;
}

/**
 * 통화 예약 결과
 */
export interface CallReservation {
  success: boolean;
  reservationId: string;
  userId: string;
  reservedAmount: number;
  expiresAt: Date;
}

/**
 * Secret-Line Call 서비스
 * * Agora RTC 토큰 생성 및 통화 선결제 관리
 */
export class CallService {
  private prisma: PrismaClient;
  
  // Agora 설정 (환경 변수에서 로드)
  private readonly AGORA_APP_ID: string;
  private readonly AGORA_APP_CERTIFICATE: string;
  
  // 통화 요금 (milli-Gold 단위)
  private readonly CALL_RATE_PER_SECOND = 25; // 1초당 25 milli-Gold
  private readonly MIN_RESERVE_SECONDS = 60;   // 최소 1분 예약
  private readonly MIN_RESERVE_AMOUNT: number;

  constructor() {
    this.prisma = new PrismaClient();
    
    // 환경 변수 로드
    this.AGORA_APP_ID = process.env.AGORA_APP_ID || '';
    this.AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';
    
    if (!this.AGORA_APP_ID || !this.AGORA_APP_CERTIFICATE) {
      console.warn('주의: Agora 설정이 아직 .env에 비어있습니다.');
    }
    
    // 최소 예약 금액 계산 (1분 = 1500 milli-Gold)
    this.MIN_RESERVE_AMOUNT = this.CALL_RATE_PER_SECOND * this.MIN_RESERVE_SECONDS;
  }

  // 상담사 상태 업데이트 (IDLE, BUSY, OFFLINE)
  async updateCounselorStatus(counselorId: string, status: 'IDLE' | 'BUSY' | 'OFFLINE'): Promise<void> {
    const key = `counselor:status:${counselorId}`;
    // @ts-ignore: redisClient may be null in dev
    await redisClient?.set?.(key, status);
  }


  // ...existing code...
  // 대기 중인 상담사 리스트 조회 (릴레이용) - 클래스 내부에서 제거

  generateAgoraToken(params: AgoraTokenParams): string {
    const { channelName, userId, role = 'publisher', expirationTimeInSeconds = 3600 } = params;
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;
    const uid = this.convertUserIdToUid(userId);

    const token = RtcTokenBuilder.buildTokenWithUid(
      this.AGORA_APP_ID,
      this.AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      agoraRole,
      privilegeExpireTime
    );

    return token;
  }

  async validateCallAccess(userId: string): Promise<CallAccessValidation> {
    try {
      const user = await userService.getUserById(userId);
      if (user.goldBalance < this.MIN_RESERVE_AMOUNT) {
        return {
          allowed: false,
          reason: `통화를 시작하려면 최소 ${this.MIN_RESERVE_AMOUNT} 골드가 필요합니다. (현재 잔액: ${user.goldBalance})`,
          userBalance: user.goldBalance,
          requiredBalance: this.MIN_RESERVE_AMOUNT,
        };
      }
      return {
        allowed: true,
        userBalance: user.goldBalance,
        requiredBalance: this.MIN_RESERVE_AMOUNT,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return {
        allowed: false,
        reason: `검증 실패: ${errorMessage}`,
        userBalance: 0,
        requiredBalance: this.MIN_RESERVE_AMOUNT,
      };
    }
  }

  async reserveCallPayment(userId: string, counselorId: string): Promise<CallReservation> {
    try {
      const validation = await this.validateCallAccess(userId);
      if (!validation.allowed) {
        throw new Error(validation.reason || '통화 접근 권한이 없습니다.');
      }

      const reservationId = `RESERVE_${Date.now()}_${userId}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const reservation = await this.prisma.callSession.create({
        data: {
          id: reservationId,
          callerId: userId,
          receiverId: counselorId,
          status: 'RESERVED',
          reservedAmount: this.MIN_RESERVE_AMOUNT,
          startedAt: new Date(),
          expiresAt,
        },
      });

      return {
        success: true,
        reservationId: reservation.id,
        userId,
        reservedAmount: this.MIN_RESERVE_AMOUNT,
        expiresAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      throw new Error(`통화 예약 실패: ${errorMessage}`);
    }
  }

  async startCall(reservationId: string): Promise<void> {
    await this.prisma.callSession.update({
      where: { id: reservationId },
      data: {
        status: 'ACTIVE',
        actualStartedAt: new Date(),
      },
    });
  }

  // 5초 무료 구간(Grace Period) 반영
  calculateCallCost(durationInSeconds: number): number {
    if (durationInSeconds <= 5) return 0;
    return Math.floor(durationInSeconds * this.CALL_RATE_PER_SECOND);
  }

  // 실시간 잔액 감시 및 알림/강제종료
  startBalanceMonitor(userId: string, socket: any, agoraSessionId: string) {
    // 1초마다 잔액 체크
    let warned1min = false;
    let warned10s = false;
    const interval = setInterval(async () => {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;
      const gold = user.goldBalance;
      // 1분(1500 milli-Gold), 10초(250 milli-Gold) 기준
      if (!warned1min && gold <= 1500) {
        socket.emit('EVENT_CALL_TIME_WARNING', { message: '잔액이 1분 남았습니다.' });
        warned1min = true;
      }
      if (!warned10s && gold <= 250) {
        socket.emit('EVENT_CALL_TIME_CRITICAL', { message: '10초 후 통화가 종료됩니다.' });
        warned10s = true;
      }
      if (gold <= 0) {
        clearInterval(interval);
        await this.forceTerminateCall(userId, socket, agoraSessionId);
      }
    }, 1000);
    return interval;
  }

  // 잔액 0시 세션 강제 종료 및 Agora 세션 파기
  async forceTerminateCall(userId: string, socket: any, agoraSessionId: string) {
    try {
      socket.emit('EVENT_CALL_TERMINATED', { message: '잔액이 모두 소진되어 통화가 종료되었습니다.' });
      socket.disconnect(true);
      // Agora 세션 파기 로직 (실제 구현 필요)
      // await agoraService.terminateSession(agoraSessionId);
      console.log(`[Evict] 유저 ${userId}의 통화 세션(Agora:${agoraSessionId}) 강제 종료`);
    } catch (e) {
      console.error('forceTerminateCall error:', e);
    }
  }

  private convertUserIdToUid(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * 10초 무한 릴레이 알고리즘
   * 상담사가 응답할 때까지 대기열의 다음 상담사에게 신호를 보냄
   */
  async startCallRelay(userId: string, channelName: string): Promise<string | null> {
    const MAX_CYCLES = 3; // 3바퀴 돌면 종료 (서킷 브레이커)
    const WAIT_TIME = 10000; // 10초 대기

    for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
      // 1. Redis에서 현재 대기 중(IDLE)인 상담사 리스트 확보
      const counselors = await getIdleCounselors();
      if (counselors.length === 0) break; // 대기 상담사 없으면 종료

      for (const counselorId of counselors) {
        // 2. 상담사에게 소켓 신호 전송 (여기서는 로직 구조만 구축)
        console.log(`[Relay] ${counselorId}에게 10초간 신호 전송 중... (Cycle ${cycle})`);
        // 3. 10초 대기 및 응답 여부 확인 (실제로는 Socket.io 이벤트와 연동)
        const isAnswered = await this.waitForCounselor(counselorId, WAIT_TIME);
        if (isAnswered) {
          await this.updateCounselorStatus(counselorId, 'BUSY');
          return counselorId; // 연결 성공
        }
        console.log(`[Relay] ${counselorId} 무응답, 다음 순번으로 이동.`);
      }
    }
    // 4. Failover: 모든 시도 실패 시 '비밀 음성' 갤러리로 리다이렉트 유도
    return this.triggerFailover(userId);
  }

  // 10초 대기 시뮬레이션 (기초 구조)
  private async waitForCounselor(counselorId: string, ms: number): Promise<boolean> {
    return new Promise((resolve) => setTimeout(() => resolve(false), ms));
  }

  // Failover 로직 (매출 방어)
  private triggerFailover(userId: string): null {
    try {
      // CallGateway 인스턴스의 server를 통해 소켓 브로드캐스트
      // (NestJS DI 환경에서는 실제 인스턴스 주입 필요, 여기선 static import 가정)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { callGateway } = require('./call.gateway');
      if (callGateway && callGateway.server) {
        callGateway.server.to(userId).emit('EVENT_CALL_FAILED_REDIRECT', {
          message: '현재 상담이 어렵습니다. 그녀가 남긴 은밀한 목소리를 먼저 들어보시겠어요?',
          redirect: '/gallery',
        });
      }
    } catch (e) {
      // fallback: 콘솔 로그
      console.log(`[Failover] 유저 ${userId}를 'Secret Voice' 갤러리로 안내합니다.`);
    }
    return null;
  }


  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// 대기 중인 상담사 리스트 조회 (릴레이용)
export const getIdleCounselors = async (): Promise<string[]> => {
  // Redis 연결 상태 체크 및 자동 연결
  if (redisClient && typeof redisClient.isOpen === 'boolean' && !redisClient.isOpen) {
    await redisClient.connect();
  }
  const keys = await redisClient?.keys?.('counselor:status:*') || [];
  const idleCounselors: string[] = [];
  for (const key of keys) {
    if (redisClient && typeof redisClient.isOpen === 'boolean' && !redisClient.isOpen) {
      await redisClient.connect();
    }
    const status = await redisClient?.get?.(key);
    const counselorId = key.split(':')[2];
    if (status === 'IDLE' && counselorId) idleCounselors.push(counselorId);
  }
  return idleCounselors;
};

export const callService = new CallService();
