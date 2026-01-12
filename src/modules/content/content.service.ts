import { PrismaClient } from '@prisma/client';
import { profitService } from '../profit/profit.service';
import { settlementFacade } from '../profit/settlement.facade';

export interface CreateSecretVoiceParams {
  creatorId: string;
  title: string;
  description?: string;
  audioUrl: string;
  thumbnailUrl?: string;
  duration: number;
  price: number;
  category?: string;
}

export interface UpdateSecretVoiceParams {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  price?: number;
  isActive?: boolean;
}

export interface ContentPurchaseResult {
  success: boolean;
  contentId: string;
  userId: string;
  purchaseId: string;
  paidAmount: number;
  creatorProfit: number;
  accessGranted: boolean;
  error?: string;
}

export interface ContentAccessCheck {
  hasAccess: boolean;
  reason?: string;
  isOwner: boolean;
  isPurchased: boolean;
  isFree: boolean;
}

export class ContentService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createSecretVoice(params: CreateSecretVoiceParams) {
    const { creatorId, title, description, audioUrl, thumbnailUrl, duration, price, category } = params;
    if (price < 0) throw new Error('가격은 0 이상이어야 합니다.');
    if (duration <= 0) throw new Error('재생 시간은 0보다 커야 합니다.');

    return await this.prisma.secretVoice.create({
      data: {
        creatorId,
        title,
        description: description ?? null,
        audioUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        duration,
        price,
        category: category ?? null,
        isActive: true
      }
    });
  }

  async getSecretVoiceList(userId?: string, options: any = {}) {
    const { category, creatorId, limit = 50, offset = 0 } = options;
    const contents = await this.prisma.secretVoice.findMany({
      where: { isActive: true, ...(category && { category }), ...(creatorId && { creatorId }) },
      include: { creator: { select: { id: true, nickname: true, crownLevel: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return await Promise.all(contents.map(async (content) => {
      let hasAccess = false;
      if (userId) {
        const check = await this.checkContentAccess(content.id, userId);
        hasAccess = check.hasAccess;
      }
      return { ...content, hasAccess, audioUrl: hasAccess ? content.audioUrl : null };
    }));
  }

  async getSecretVoice(contentId: string, userId?: string) {
    const content = await this.prisma.secretVoice.findUnique({
      where: { id: contentId },
      include: { creator: { select: { id: true, nickname: true, crownLevel: true } } }
    });
    if (!content) throw new Error('콘텐츠를 찾을 수 없습니다.');
    let hasAccess = false;
    if (userId) {
      const check = await this.checkContentAccess(contentId, userId);
      hasAccess = check.hasAccess;
    }
    await this.prisma.secretVoice.update({ where: { id: contentId }, data: { viewCount: { increment: 1 } } });
    return { ...content, hasAccess, audioUrl: hasAccess ? content.audioUrl : null };
  }

  async checkContentAccess(contentId: string, userId: string): Promise<ContentAccessCheck> {
    const content = await this.prisma.secretVoice.findUnique({ where: { id: contentId } });
    if (!content) return { hasAccess: false, isOwner: false, isPurchased: false, isFree: false };
    if (content.creatorId === userId) return { hasAccess: true, isOwner: true, isPurchased: false, isFree: false };
    if (content.price === 0) return { hasAccess: true, isOwner: false, isPurchased: false, isFree: true };
    const purchase = await this.prisma.contentPurchase.findFirst({ where: { contentId, userId } });
    return { hasAccess: !!purchase, isOwner: false, isPurchased: !!purchase, isFree: false };
  }

  async purchaseContent(contentId: string, userId: string): Promise<ContentPurchaseResult> {
    try {
      const content = await this.prisma.secretVoice.findUnique({ where: { id: contentId } });
      if (!content || !content.isActive) throw new Error('구매 불가능한 콘텐츠입니다.');
      const existing = await this.prisma.contentPurchase.findFirst({ where: { contentId, userId } });
      if (existing) throw new Error('이미 구매한 콘텐츠입니다.');
      if (content.creatorId === userId) throw new Error('자신의 콘텐츠는 구매할 수 없습니다.');

      // 밀리골드 단위로 환산
      const milliAmount = content.price * 100;
      // profitService를 직접 호출하여 추천인 보너스 등 모든 분배 반영
      const settlement = await profitService.settleTransaction({
        payerId: userId,
        payeeId: content.creatorId,
        amount: milliAmount,
        type: 'CONTENT_PURCHASE',
        details: `Secret Voice 구매: ${content.title}`,
      });

      // DB에는 원래 Gold 단위로 기록
      const creatorProfitGold = Math.floor(milliAmount * 0.5) / 100;
      const purchase = await this.prisma.contentPurchase.create({
        data: { contentId, userId, paidAmount: content.price, creatorProfit: creatorProfitGold }
      });
      await this.prisma.secretVoice.update({ where: { id: contentId }, data: { purchaseCount: { increment: 1 } } });

      return { success: true, contentId, userId, purchaseId: purchase.id, paidAmount: content.price, creatorProfit: creatorProfitGold, accessGranted: true };
    } catch (error: any) {
      return { success: false, contentId, userId, purchaseId: '', paidAmount: 0, creatorProfit: 0, accessGranted: false, error: error.message };
    }
  }

  async updateSecretVoice(contentId: string, creatorId: string, params: UpdateSecretVoiceParams) {
    const content = await this.prisma.secretVoice.findUnique({ where: { id: contentId } });
    if (!content || content.creatorId !== creatorId) throw new Error('권한이 없습니다.');
    return await this.prisma.secretVoice.update({ where: { id: contentId }, data: params });
  }

  async deleteSecretVoice(contentId: string, creatorId: string) {
    const content = await this.prisma.secretVoice.findUnique({ where: { id: contentId } });
    if (!content || content.creatorId !== creatorId) throw new Error('권한이 없습니다.');
    return await this.prisma.secretVoice.update({ where: { id: contentId }, data: { isActive: false } });
  }

  async getCreatorRevenue(creatorId: string) {
    const purchases = await this.prisma.contentPurchase.findMany({ where: { content: { creatorId } } });
    const totalRevenue = purchases.reduce((sum, p) => sum + p.creatorProfit, 0);
    return { creatorId, totalRevenue, totalSales: purchases.length };
  }
}

export const contentService = new ContentService();
