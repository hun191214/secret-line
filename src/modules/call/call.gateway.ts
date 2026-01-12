import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

interface PendingCall {
  userId: string;
  timestamp: number;
}

@WebSocketGateway()
export class CallGateway {
  @WebSocketServer()
  public server!: Server;

  private pendingCalls: Map<string, PendingCall> = new Map();
  private prisma = new PrismaClient();

  @SubscribeMessage('handleCall')
  async handleCall(@MessageBody() data: { userId: string }, @ConnectedSocket() client: Socket) {
    const { userId } = data;
    // 유저 잔액 확인
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.goldBalance < 15) {
      client.emit('callError', { message: '잔액이 부족합니다' });
      return;
    }
    // 대기열에 추가 (10초 릴레이 구조)
    this.pendingCalls.set(userId, { userId, timestamp: Date.now() });
    client.emit('callPending', { message: '상담사 연결 대기 중입니다.' });
    // 실제 릴레이 로직은 추후 구현
  }
}

// 싱글턴 인스턴스 export
export const callGatewaySingleton = new CallGateway();
