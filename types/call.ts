/**
 * 통화 관련 TypeScript 타입 정의
 */

export type CallStatus = 'INITIATED' | 'CONNECTING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export interface Call {
  id: string;
  callerId: string;
  counselorId: string;
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // 초 단위
  cost?: number; // USD
  agoraChannel?: string;
  agoraToken?: string;
  referralId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCallRequest {
  callerId: string;
  counselorId: string;
  referralCode?: string;
}

export interface AgoraTokenResponse {
  token: string;
  channelName: string;
  uid: number;
}

