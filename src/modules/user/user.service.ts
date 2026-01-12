
import { PrismaClient, CrownLevel } from '@prisma/client';

interface CrownUpdateResult {
  userId: string;
  previousLevel: CrownLevel;
  newLevel: CrownLevel;
  accumulatedSpend: number;
  updated: boolean;
}

export class UserService {
    async updateUserCrownLevel(userId: string): Promise<CrownUpdateResult> {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, accumulatedSpend: true, crownLevel: true },
      });
      if (!user) throw new Error('유저를 찾을 수 없습니다.');
      const newLevel: CrownLevel = this.calculateCrownLevel(user.accumulatedSpend);
      if (user.crownLevel === newLevel) {
        return {
          userId: user.id,
          previousLevel: user.crownLevel,
          newLevel: user.crownLevel,
          accumulatedSpend: user.accumulatedSpend,
          updated: false,
        };
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { crownLevel: newLevel },
      });
      return {
        userId: user.id,
        previousLevel: user.crownLevel,
        newLevel,
        accumulatedSpend: user.accumulatedSpend,
        updated: true,
      };
    }
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 상담사 설정(저사양 모드 등) 업데이트
   * @param userId 유저 ID
   * @param settings { isLiteMode?: boolean }
   */

  async updateSettings(userId: string, settings: { isLiteMode?: boolean }): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { ...settings },
    });
  }



  private calculateCrownLevel(accumulatedSpend: number): CrownLevel {
    if (accumulatedSpend >= 500000) return CrownLevel.PLATINUM;
    if (accumulatedSpend >= 100000) return CrownLevel.GOLD;
    if (accumulatedSpend >= 10000) return CrownLevel.SILVER;
    return CrownLevel.BRONZE;
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('유저를 찾을 수 없습니다.');
    return user;
  }

  async getUserGoldBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { goldBalance: true },
    });
    if (!user) throw new Error('유저를 찾을 수 없습니다.');
    return user.goldBalance;
  }

  async getUserCrownLevel(userId: string): Promise<CrownLevel> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { crownLevel: true },
    });
    if (!user) throw new Error('유저를 찾을 수 없습니다.');
    return user.crownLevel;
  }

  async getUsersByLevel(crownLevel: CrownLevel, limit: number = 100) {
    return await this.prisma.user.findMany({
      where: { crownLevel },
      orderBy: { accumulatedSpend: 'desc' },
      take: limit,
    });
  }

  async getUserStats(userId: string) {
    const user = await this.getUserById(userId);
    const nextLevelThreshold = this.getNextLevelThreshold(user.crownLevel);
    const goldToNextLevel = nextLevelThreshold ? nextLevelThreshold - user.accumulatedSpend : 0;

    return {
      userId: user.id,
      nickname: user.nickname,
      goldBalance: user.goldBalance,
      accumulatedSpend: user.accumulatedSpend,
      crownLevel: user.crownLevel,
      nextLevelThreshold,
      goldToNextLevel: goldToNextLevel > 0 ? goldToNextLevel : 0,
      isMaxLevel: user.crownLevel === CrownLevel.PLATINUM,
    };
  }

  private getNextLevelThreshold(currentLevel: CrownLevel): number | null {
    switch (currentLevel) {
      case CrownLevel.BRONZE: return 10000;
      case CrownLevel.SILVER: return 100000;
      case CrownLevel.GOLD: return 500000;
      case CrownLevel.PLATINUM: return null;
      default: return null;
    }
  }

  async getCrownLevelDistribution() {
    const distribution = await this.prisma.user.groupBy({
      by: ['crownLevel'],
      _count: { crownLevel: true },
    });
    return distribution.map((item) => ({
      level: item.crownLevel,
      count: item._count.crownLevel,
    }));
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export const userService = new UserService();