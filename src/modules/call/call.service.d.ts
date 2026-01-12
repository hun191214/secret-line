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
export declare class CallService {
    private prisma;
    private readonly AGORA_APP_ID;
    private readonly AGORA_APP_CERTIFICATE;
    private readonly CALL_RATE_PER_SECOND;
    private readonly MIN_RESERVE_SECONDS;
    private readonly MIN_RESERVE_AMOUNT;
    constructor();
    updateCounselorStatus(counselorId: string, status: 'IDLE' | 'BUSY' | 'OFFLINE'): Promise<void>;
    generateAgoraToken(params: AgoraTokenParams): string;
    validateCallAccess(userId: string): Promise<CallAccessValidation>;
    reserveCallPayment(userId: string, counselorId: string): Promise<CallReservation>;
    startCall(reservationId: string): Promise<void>;
    calculateCallCost(durationInSeconds: number): number;
    startBalanceMonitor(userId: string, socket: any, agoraSessionId: string): NodeJS.Timeout;
    forceTerminateCall(userId: string, socket: any, agoraSessionId: string): Promise<void>;
    private convertUserIdToUid;
    /**
     * 10초 무한 릴레이 알고리즘
     * 상담사가 응답할 때까지 대기열의 다음 상담사에게 신호를 보냄
     */
    startCallRelay(userId: string, channelName: string): Promise<string | null>;
    private waitForCounselor;
    private triggerFailover;
    disconnect(): Promise<void>;
}
export declare const getIdleCounselors: () => Promise<string[]>;
export declare const callService: CallService;
//# sourceMappingURL=call.service.d.ts.map