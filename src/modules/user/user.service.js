"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const client_1 = require("@prisma/client");
class UserService {
    async updateUserCrownLevel(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, accumulatedSpend: true, crownLevel: true },
        });
        if (!user)
            throw new Error('유저를 찾을 수 없습니다.');
        const newLevel = this.calculateCrownLevel(user.accumulatedSpend);
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
    prisma;
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    /**
     * 상담사 설정(저사양 모드 등) 업데이트
     * @param userId 유저 ID
     * @param settings { isLiteMode?: boolean }
     */
    async updateSettings(userId, settings) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { ...settings },
        });
    }
    calculateCrownLevel(accumulatedSpend) {
        if (accumulatedSpend >= 500000)
            return client_1.CrownLevel.PLATINUM;
        if (accumulatedSpend >= 100000)
            return client_1.CrownLevel.GOLD;
        if (accumulatedSpend >= 10000)
            return client_1.CrownLevel.SILVER;
        return client_1.CrownLevel.BRONZE;
    }
    async getUserById(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('유저를 찾을 수 없습니다.');
        return user;
    }
    async getUserGoldBalance(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { goldBalance: true },
        });
        if (!user)
            throw new Error('유저를 찾을 수 없습니다.');
        return user.goldBalance;
    }
    async getUserCrownLevel(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { crownLevel: true },
        });
        if (!user)
            throw new Error('유저를 찾을 수 없습니다.');
        return user.crownLevel;
    }
    async getUsersByLevel(crownLevel, limit = 100) {
        return await this.prisma.user.findMany({
            where: { crownLevel },
            orderBy: { accumulatedSpend: 'desc' },
            take: limit,
        });
    }
    async getUserStats(userId) {
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
            isMaxLevel: user.crownLevel === client_1.CrownLevel.PLATINUM,
        };
    }
    getNextLevelThreshold(currentLevel) {
        switch (currentLevel) {
            case client_1.CrownLevel.BRONZE: return 10000;
            case client_1.CrownLevel.SILVER: return 100000;
            case client_1.CrownLevel.GOLD: return 500000;
            case client_1.CrownLevel.PLATINUM: return null;
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
    async disconnect() {
        await this.prisma.$disconnect();
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=user.service.js.map