import { CrownLevel } from '@prisma/client';
interface CrownUpdateResult {
    userId: string;
    previousLevel: CrownLevel;
    newLevel: CrownLevel;
    accumulatedSpend: number;
    updated: boolean;
}
export declare class UserService {
    updateUserCrownLevel(userId: string): Promise<CrownUpdateResult>;
    private prisma;
    constructor();
    /**
     * 상담사 설정(저사양 모드 등) 업데이트
     * @param userId 유저 ID
     * @param settings { isLiteMode?: boolean }
     */
    updateSettings(userId: string, settings: {
        isLiteMode?: boolean;
    }): Promise<void>;
    private calculateCrownLevel;
    getUserById(userId: string): Promise<{
        id: string;
        nickname: string;
        role: import(".prisma/client").$Enums.Role;
        goldBalance: number;
        accumulatedSpend: number;
        crownLevel: import(".prisma/client").$Enums.CrownLevel;
        referrerId: string | null;
        isLiteMode: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getUserGoldBalance(userId: string): Promise<number>;
    getUserCrownLevel(userId: string): Promise<CrownLevel>;
    getUsersByLevel(crownLevel: CrownLevel, limit?: number): Promise<{
        id: string;
        nickname: string;
        role: import(".prisma/client").$Enums.Role;
        goldBalance: number;
        accumulatedSpend: number;
        crownLevel: import(".prisma/client").$Enums.CrownLevel;
        referrerId: string | null;
        isLiteMode: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getUserStats(userId: string): Promise<{
        userId: string;
        nickname: string;
        goldBalance: number;
        accumulatedSpend: number;
        crownLevel: import(".prisma/client").$Enums.CrownLevel;
        nextLevelThreshold: number | null;
        goldToNextLevel: number;
        isMaxLevel: boolean;
    }>;
    private getNextLevelThreshold;
    getCrownLevelDistribution(): Promise<{
        level: import(".prisma/client").$Enums.CrownLevel;
        count: number;
    }[]>;
    disconnect(): Promise<void>;
}
export declare const userService: UserService;
export {};
//# sourceMappingURL=user.service.d.ts.map