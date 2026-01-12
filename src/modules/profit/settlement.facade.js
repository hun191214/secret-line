"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementFacade = exports.SettlementFacade = void 0;
const profit_service_1 = require("./profit.service");
const user_service_1 = require("../user/user.service");
/**
 * Secret-Line 통합 정산 Facade v19.1
 */
class SettlementFacade {
    // 유저 통계 통합 조회
    async getUserStats(userId) {
        const [profitStats, userStats] = await Promise.all([
            profit_service_1.profitService.getUserProfitStats(userId),
            user_service_1.userService.getUserStats(userId),
        ]);
        return { profit: profitStats, crown: userStats };
    }
    // 콘텐츠 구매 등에서 사용하는 통합 정산 실행
    async executeFullSettlement(params) {
        try {
            const settlement = await profit_service_1.profitService.settleTransaction({
                payerId: params.payerId,
                payeeId: params.payeeId,
                amount: params.amount,
                type: params.type,
                details: ''
            });
            return { success: true, settlement };
        }
        catch (error) {
            return { success: false, settlement: null, error: error.message };
        }
    }
}
exports.SettlementFacade = SettlementFacade;
exports.settlementFacade = new SettlementFacade();
//# sourceMappingURL=settlement.facade.js.map