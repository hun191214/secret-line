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
export declare class ContentService {
    private prisma;
    constructor();
    createSecretVoice(params: CreateSecretVoiceParams): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        creatorId: string;
        title: string;
        audioUrl: string;
        thumbnailUrl: string | null;
        duration: number;
        category: string | null;
        isActive: boolean;
        viewCount: number;
        purchaseCount: number;
    }>;
    getSecretVoiceList(userId?: string, options?: any): Promise<{
        hasAccess: boolean;
        audioUrl: string | null;
        creator: {
            id: string;
            nickname: string;
            crownLevel: import(".prisma/client").$Enums.CrownLevel;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        creatorId: string;
        title: string;
        thumbnailUrl: string | null;
        duration: number;
        category: string | null;
        isActive: boolean;
        viewCount: number;
        purchaseCount: number;
    }[]>;
    getSecretVoice(contentId: string, userId?: string): Promise<{
        hasAccess: boolean;
        audioUrl: string | null;
        creator: {
            id: string;
            nickname: string;
            crownLevel: import(".prisma/client").$Enums.CrownLevel;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        creatorId: string;
        title: string;
        thumbnailUrl: string | null;
        duration: number;
        category: string | null;
        isActive: boolean;
        viewCount: number;
        purchaseCount: number;
    }>;
    checkContentAccess(contentId: string, userId: string): Promise<ContentAccessCheck>;
    purchaseContent(contentId: string, userId: string): Promise<ContentPurchaseResult>;
    updateSecretVoice(contentId: string, creatorId: string, params: UpdateSecretVoiceParams): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        creatorId: string;
        title: string;
        audioUrl: string;
        thumbnailUrl: string | null;
        duration: number;
        category: string | null;
        isActive: boolean;
        viewCount: number;
        purchaseCount: number;
    }>;
    deleteSecretVoice(contentId: string, creatorId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        creatorId: string;
        title: string;
        audioUrl: string;
        thumbnailUrl: string | null;
        duration: number;
        category: string | null;
        isActive: boolean;
        viewCount: number;
        purchaseCount: number;
    }>;
    getCreatorRevenue(creatorId: string): Promise<{
        creatorId: string;
        totalRevenue: number;
        totalSales: number;
    }>;
}
export declare const contentService: ContentService;
//# sourceMappingURL=content.service.d.ts.map