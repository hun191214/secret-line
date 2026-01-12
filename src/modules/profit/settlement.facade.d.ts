import type { SettlementResult, UserProfitStats } from './profit.service';
/**
 * Secret-Line 통합 정산 Facade v19.1
 */
export declare class SettlementFacade {
    getUserStats(userId: string): Promise<{
        profit: UserProfitStats;
        crown: any;
    }>;
    executeFullSettlement(params: {
        payerId: string;
        payeeId: string;
        amount: number;
        type: string;
        updatePayeeCrown?: boolean;
    }): Promise<{
        success: boolean;
        settlement: SettlementResult;
        error?: string;
    }>;
}
export declare const settlementFacade: SettlementFacade;
//# sourceMappingURL=settlement.facade.d.ts.map