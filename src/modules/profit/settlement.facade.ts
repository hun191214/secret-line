import { profitService } from './profit.service';
import { userService } from '../user/user.service';
import type { SettlementResult, UserProfitStats } from './profit.service';

/**
 * Secret-Line 통합 정산 Facade v19.1
 */
export class SettlementFacade {
  // 유저 통계 통합 조회
  async getUserStats(userId: string): Promise<{ profit: UserProfitStats; crown: any }> {
    const [profitStats, userStats] = await Promise.all([
      profitService.getUserProfitStats(userId),
      userService.getUserStats(userId),
    ]);
    return { profit: profitStats, crown: userStats };
  }

  // 콘텐츠 구매 등에서 사용하는 통합 정산 실행
  async executeFullSettlement(params: {
    payerId: string;
    payeeId: string;
    amount: number;
    type: string;
    updatePayeeCrown?: boolean;
  }): Promise<{ success: boolean; settlement: SettlementResult; error?: string }> {
    try {
      const settlement = await profitService.settleTransaction({
        payerId: params.payerId,
        payeeId: params.payeeId,
        amount: params.amount,
        type: params.type,
        details: ''
      });
      return { success: true, settlement };
    } catch (error: any) {
      return { success: false, settlement: null as any, error: error.message };
    }
  }
}
export const settlementFacade = new SettlementFacade();