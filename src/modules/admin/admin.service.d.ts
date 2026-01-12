export declare class AdminService {
    /**
     * 관리자 통합 지표 반환
     */
    getStats(): Promise<{
        totalUserGold: number;
        todayRevenue: number;
        operatorNetProfit: number;
        activeCallsCount: number;
    }>;
    /**
     * 대기 중 상담사 닉네임 및 품질 등급 리스트 반환
     */
    getIdleCounselorList(): Promise<{
        nickname: string;
        crownLevel: import(".prisma/client").$Enums.CrownLevel;
    }[]>;
}
export declare const adminService: AdminService;
//# sourceMappingURL=admin.service.d.ts.map