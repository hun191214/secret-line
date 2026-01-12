export interface SettlementResult {
    success: boolean;
    totalAmount: number;
    payeeProfit: number;
    operatorProfit: number;
    payerReferralBonus: number;
    payeeReferralBonus: number;
    transactionIds: string[];
}
export interface SettleTransactionParams {
    payerId: string;
    payeeId: string;
    amount: number;
    type: string;
    details?: string;
}
export interface UserProfitStats {
    totalEarned: number;
    totalSpent: number;
    referralBonus: number;
    netProfit: number;
}
export declare class ProfitService {
    private prisma;
    constructor();
    settleTransaction(params: SettleTransactionParams): Promise<SettlementResult>;
    getUserProfitStats(userId: string): Promise<UserProfitStats>;
}
export declare const profitService: ProfitService;
//# sourceMappingURL=profit.service.d.ts.map