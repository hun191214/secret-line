"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const profit_service_1 = require("./modules/profit/profit.service");
const admin_service_1 = require("./modules/admin/admin.service");
const call_service_1 = require("./modules/call/call.service");
const prisma = new client_1.PrismaClient();
async function main() {
    // Step 0: 테스트 환경 초기화 (참조 순서 주의)
    try {
        await prisma.agencyLedger.deleteMany({});
        await prisma.contentPurchase.deleteMany({});
        await prisma.callSession.deleteMany({});
        await prisma.call.deleteMany({});
        await prisma.transaction.deleteMany({});
        await prisma.paymentRecord.deleteMany({});
        await prisma.user.deleteMany({});
        console.log('[초기화] 모든 테이블 데이터 삭제 완료');
    }
    catch (e) {
        console.error('[초기화] 테이블 삭제 실패:', e);
        process.exit(1);
    }
    // 유저/상담사/추천인 생성
    try {
        await prisma.user.createMany({
            data: [
                { id: 'bob', nickname: 'Bob', goldBalance: 30000, referrerId: 'alice', accumulatedSpend: 0 },
                { id: 'joy', nickname: 'Joy', goldBalance: 0, referrerId: 'managerk', accumulatedSpend: 0 },
                { id: 'alice', nickname: 'Alice', goldBalance: 0, accumulatedSpend: 0 },
                { id: 'managerk', nickname: 'Manager-K', goldBalance: 0, accumulatedSpend: 0 },
                { id: 'operator', nickname: 'Operator', goldBalance: 0, accumulatedSpend: 0 },
            ],
            skipDuplicates: true,
        });
        console.log('[초기화] 테스트 유저 데이터 생성 완료');
    }
    catch (e) {
        console.error('[초기화] 유저 데이터 생성 실패:', e);
        process.exit(1);
    }
    // Step 1: Bob이 Joy에게 통화 예약 (15 Gold)
    let reservationId = '';
    try {
        const reservation = await call_service_1.callService.reserveCallPayment('bob', 'joy');
        reservationId = reservation.reservationId;
        console.log('[Step 1] 통화 예약 성공:', reservation);
    }
    catch (e) {
        console.error('[Step 1] 통화 예약 실패:', e);
        return;
    }
    // Step 2: 10초간 통화 유지, 5초 무료 구간 후 125 mGold 정산
    // (실제 통화 시간: 10초, 과금: 5초 * 25mG = 125mG)
    const duration = 10; // seconds
    const chargeable = Math.max(0, duration - 5);
    const milliGold = chargeable * 25;
    console.log(`[Step 2] 통화 시간: ${duration}s, 과금 구간: ${chargeable}s, 정산 금액: ${milliGold} mGold`);
    // Step 3: Bob의 잔액을 0으로 강제 변경 후 forceTerminateCall 시뮬
    await prisma.user.update({ where: { id: 'bob' }, data: { goldBalance: 0 } });
    try {
        await call_service_1.callService.forceTerminateCall('bob', { emit: (...args) => console.log('[SOCKET]', ...args), disconnect: () => console.log('[SOCKET] disconnect()') }, 'agora-session-1');
        console.log('[Step 3] forceTerminateCall 정상 호출됨');
    }
    catch (e) {
        console.error('[Step 3] forceTerminateCall 에러:', e);
    }
    // Step 4: 최종 정산 실행 (예약된 15 Gold 중 실제 사용 125 mGold)
    try {
        const result = await profit_service_1.profitService.settleTransaction({
            payerId: 'bob',
            payeeId: 'joy',
            amount: milliGold,
            type: 'CALL',
            details: '통화 종료 정산'
        });
        console.log('[Step 4] 최종 정산 성공:', result);
    }
    catch (e) {
        console.error('[Step 4] 최종 정산 실패:', e);
        return;
    }
    // 결과: AgencyLedger, AdminStats
    const aliceLedger = await prisma.agencyLedger.findMany({ where: { agentId: 'alice' } });
    const managerkLedger = await prisma.agencyLedger.findMany({ where: { agentId: 'managerk' } });
    const stats = await admin_service_1.adminService.getStats();
    console.log('=== AgencyLedger 보너스 내역 ===');
    console.table([
        { user: 'Alice', bonus: aliceLedger.reduce((s, l) => s + l.amount, 0) },
        { user: 'Manager-K', bonus: managerkLedger.reduce((s, l) => s + l.amount, 0) },
    ]);
    console.log('=== 관리자 통합 지표 ===');
    console.table([
        {
            totalUserGold: stats.totalUserGold,
            todayRevenue: stats.todayRevenue,
            operatorNetProfit: stats.operatorNetProfit,
            activeCallsCount: stats.activeCallsCount,
        },
    ]);
}
main()
    .catch((e) => {
    console.error('테스트 실패:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=test-integrated-flow.js.map