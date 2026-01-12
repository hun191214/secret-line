"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminService = exports.AdminService = void 0;
const client_1 = require("@prisma/client");
const call_service_1 = require("../call/call.service");
const prisma = new client_1.PrismaClient();
class AdminService {
    /**
     * 관리자 통합 지표 반환
     */
    async getStats() {
        // 전체 유저 Gold 총합
        const totalUserGold = await prisma.user.aggregate({ _sum: { goldBalance: true } });
        // 오늘 발생한 총 매출 (트랜잭션)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const todayRevenue = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                amount: { gt: 0 },
                createdAt: { gte: today, lt: tomorrow },
            },
        });
        // 운영자 계정 순수익
        const operator = await prisma.user.findUnique({ where: { id: 'operator' } });
        // 현재 ACTIVE 상태인 통화 세션 수
        const activeCallsCount = await prisma.callSession.count({ where: { status: 'ACTIVE' } });
        return {
            totalUserGold: totalUserGold._sum.goldBalance ?? 0,
            todayRevenue: todayRevenue._sum.amount ?? 0,
            operatorNetProfit: operator?.goldBalance ?? 0,
            activeCallsCount,
        };
    }
    /**
     * 대기 중 상담사 닉네임 및 품질 등급 리스트 반환
     */
    async getIdleCounselorList() {
        const idleIds = await (0, call_service_1.getIdleCounselors)();
        const counselors = await prisma.user.findMany({
            where: { id: { in: idleIds } },
            select: { nickname: true, crownLevel: true },
        });
        return counselors;
    }
}
exports.AdminService = AdminService;
exports.adminService = new AdminService();
//# sourceMappingURL=admin.service.js.map