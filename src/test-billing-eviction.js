"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const call_service_1 = require("./modules/call/call.service");
// Mock socket for test
class MockSocket {
    events = [];
    emit(event, payload) {
        this.events.push({ event, payload });
        console.log(`[SOCKET] ${event}:`, payload.message);
    }
    disconnect(force) {
        console.log(`[SOCKET] disconnect() called. force=${force}`);
    }
}
(async () => {
    const prisma = new client_1.PrismaClient();
    const bobId = 'f2caa1a1-3af0-4c60-b0b1-84248fb3ec7a';
    const joyId = 'c7a609b5-e6dd-403f-971f-afce5ccbdc89';
    const agoraSessionId = 'test-agora-session';
    // 1. Bob의 잔액을 50 Gold로 세팅
    await prisma.user.update({ where: { id: bobId }, data: { goldBalance: 50 } });
    console.log('Bob의 잔액을 50 Gold로 세팅 완료');
    // 2. 통화 시작 (가속 시뮬레이션: 1초당 25 Gold 소모로 설정)
    // 실제 서비스는 milli-Gold(25)지만, 테스트를 위해 1초당 25 Gold로 가정
    let gold = 50;
    let seconds = 0;
    const socket = new MockSocket();
    let warned1min = false;
    let terminated = false;
    while (gold > 0 && !terminated) {
        seconds++;
        gold -= 25;
        // 1분(15 Gold) 남았을 때 경고
        if (!warned1min && gold <= 15 && gold > 0) {
            socket.emit('EVENT_CALL_TIME_WARNING', { message: '잔액이 1분 남았습니다.' });
            warned1min = true;
        }
        if (gold <= 0) {
            // 강제 종료
            await call_service_1.callService.forceTerminateCall(bobId, socket, agoraSessionId);
            terminated = true;
            break;
        }
        await new Promise((r) => setTimeout(r, 200)); // 빠른 테스트를 위해 0.2초 sleep
    }
    console.log(`총 통화 시간: ${seconds}초, 최종 잔액: ${gold}`);
    await prisma.$disconnect();
})();
//# sourceMappingURL=test-billing-eviction.js.map