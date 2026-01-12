import { PrismaClient } from '@prisma/client';

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

export class ProfitService {
  private prisma: PrismaClient;
  constructor() { this.prisma = new PrismaClient(); }

  async settleTransaction(params: SettleTransactionParams): Promise<SettlementResult> {
    const { payerId, payeeId, amount, type, details } = params;
    const result = await this.prisma.$transaction(async (tx) => {
      const [payer, payee] = await Promise.all([
        tx.user.findUnique({ where: { id: payerId } }),
        tx.user.findUnique({ where: { id: payeeId } }),
      ]);
      if (!payer || !payee) throw new Error('사용자를 찾을 수 없습니다.');

      // 5:5 정산
      const payeeProfit = Math.floor(amount * 0.5);
      let operatorProfit = Math.floor(amount * 0.5);
      let payerReferralBonus = 0;
      let payeeReferralBonus = 0;
      const transactionIds: string[] = [];

      // 5% 리퍼럴 보너스 (지불자 추천인)
      if (payer.referrerId) {
        payerReferralBonus = Math.floor(amount * 0.05);
        operatorProfit -= payerReferralBonus;
        const payerRefTx = await tx.transaction.create({
          data: {
            userId: payer.referrerId,
            amount: payerReferralBonus,
            type: 'REFERRAL',
            details: `추천인(${payerId}) 결제 5% 보너스`,
          },
        });
        transactionIds.push(payerRefTx.id);
        await tx.user.update({ where: { id: payer.referrerId }, data: { goldBalance: { increment: payerReferralBonus } } });
        // AgencyLedger 기록 (밀리골드 단위, 정수)
        await tx.agencyLedger.create({
          data: {
            agentId: payer.referrerId,
            amount: payerReferralBonus,
            description: `추천인(${payerId}) 결제 5% 보너스`,
          },
        });
      }
      // 5% 리퍼럴 보너스 (수취자 추천인)
      if (payee.referrerId) {
        payeeReferralBonus = Math.floor(amount * 0.05);
        operatorProfit -= payeeReferralBonus;
        const payeeRefTx = await tx.transaction.create({
          data: {
            userId: payee.referrerId,
            amount: payeeReferralBonus,
            type: 'REFERRAL',
            details: `추천인(${payeeId}) 수익 5% 보너스`,
          },
        });
        transactionIds.push(payeeRefTx.id);
        await tx.user.update({ where: { id: payee.referrerId }, data: { goldBalance: { increment: payeeReferralBonus } } });
        // AgencyLedger 기록 (밀리골드 단위, 정수)
        await tx.agencyLedger.create({
          data: {
            agentId: payee.referrerId,
            amount: payeeReferralBonus,
            description: `추천인(${payeeId}) 수익 5% 보너스`,
          },
        });
      }

      // 지불자 차감
      const payerTx = await tx.transaction.create({
        data: {
          userId: payerId,
          amount: -amount,
          type,
          details: details || '',
        },
      });
      transactionIds.push(payerTx.id);
      await tx.user.update({ where: { id: payerId }, data: { goldBalance: { decrement: amount }, accumulatedSpend: { increment: amount } } });

      // 수취자 지급
      const payeeTx = await tx.transaction.create({
        data: {
          userId: payeeId,
          amount: payeeProfit,
          type,
          details: details || '',
        },
      });
      transactionIds.push(payeeTx.id);
      await tx.user.update({ where: { id: payeeId }, data: { goldBalance: { increment: payeeProfit } } });

      // 운영자 몫 기록 (가상 유저 "operator"로 기록)
      if (operatorProfit > 0) {
        const opTx = await tx.transaction.create({
          data: {
            userId: 'operator',
            amount: operatorProfit,
            type,
            details: '운영자 몫',
          },
        });
        transactionIds.push(opTx.id);
        // operator 유저의 goldBalance도 증가
        await tx.user.update({
          where: { id: 'operator' },
          data: { goldBalance: { increment: operatorProfit } }
        });
      }

      return { success: true, totalAmount: amount, payeeProfit, operatorProfit, payerReferralBonus, payeeReferralBonus, transactionIds };
    });
    // 왕관 등급 업데이트 (정산 후)
    const { userService } = await import('../user/user.service');
    await userService.updateUserCrownLevel(params.payerId);
    return result;
  }

  async getUserProfitStats(userId: string): Promise<UserProfitStats> {
    const txs = await this.prisma.transaction.findMany({ where: { userId } });
    const totalEarned = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSpent = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const referralBonus = txs.filter(t => t.type === 'REFERRAL').reduce((s, t) => s + t.amount, 0);
    return { totalEarned, totalSpent, referralBonus, netProfit: totalEarned - totalSpent };
  }
}
export const profitService = new ProfitService();