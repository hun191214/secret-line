"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const profit_service_1 = require("./modules/profit/profit.service");
const admin_service_1 = require("./modules/admin/admin.service");
const prisma = new client_1.PrismaClient();
async function main() {
    // 1. 테스트 유저/상담사/추천인 관계 설정
    // Bob(유저), Joy(상담사), Alice(유저추천인), Manager-K(상담사추천인)
    await prisma.user.createMany({
        data: [
            { id: 'bob', nickname: 'Bob', goldBalance: 100000, referrerId: 'alice', accumulatedSpend: 0 },
            { id: 'joy', nickname: 'Joy', goldBalance: 0, referrerId: 'managerk', accumulatedSpend: 0 },
            { id: 'alice', nickname: 'Alice', goldBalance: 0, accumulatedSpend: 0 },
            { id: 'managerk', nickname: 'Manager-K', goldBalance: 0, accumulatedSpend: 0 },
            { id: 'operator', nickname: 'Operator', goldBalance: 0, accumulatedSpend: 0 },
        ],
        skipDuplicates: true,
    });
    // 2. 1분 통화(15 Gold) 종료 시뮬레이션
    const callAmount = 1500; // 1분 = 1500 milli-Gold = 15 Gold
    const result = await profit_service_1.profitService.settleTransaction({
        payerId: 'bob',
        payeeId: 'joy',
        amount: callAmount,
        type: 'CALL',
        details: '1분 통화 종료'
    });
    // 3. AgencyLedger 보너스 검증
    const aliceLedger = await prisma.agencyLedger.findMany({ where: { agentId: 'alice' } });
    const managerkLedger = await prisma.agencyLedger.findMany({ where: { agentId: 'managerk' } });
    // 4. 관리자 통합 지표 검증
    const stats = await admin_service_1.adminService.getStats();
    // 5. 결과 출력
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
//# sourceMappingURL=test-agency-flow.js.map