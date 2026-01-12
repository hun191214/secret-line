export declare function getLiteModeConfig(): {
    audioBitrate: number;
    skipAnimation: boolean;
};
export interface NetworkQualityMetrics {
    latency: number;
    jitter: number;
    packetLoss: number;
    bandwidth: number;
    timestamp: number;
}
export declare enum NetworkQuality {
    EXCELLENT = "EXCELLENT",
    GOOD = "GOOD",
    FAIR = "FAIR",
    POOR = "POOR"
}
export interface NetworkValidationResult {
    passed: boolean;
    quality: NetworkQuality;
    metrics: NetworkQualityMetrics;
    message: string;
    recommendations?: string[];
}
export interface AdaptiveBitrateConfig {
    quality: NetworkQuality;
    audioBitrate: number;
    videoEnabled: boolean;
    sampleRate: number;
    channelCount: 1 | 2;
}
export interface CounselorStatusRequest {
    counselorId: string;
    targetStatus: 'IDLE' | 'BUSY' | 'OFFLINE';
    networkMetrics?: NetworkQualityMetrics;
}
export declare class GatekeeperService {
    private prisma;
    private redis;
    private readonly QUALITY_THRESHOLDS;
    private readonly MIN_QUALITY_FOR_IDLE;
    constructor();
    validateNetworkQuality(counselorId: string, metrics: NetworkQualityMetrics): Promise<NetworkValidationResult>;
    private calculateNetworkQuality;
    private isQualityAcceptable;
    private cacheNetworkMetrics;
    getAdaptiveBitrateConfig(quality: NetworkQuality, isLiteMode?: boolean): AdaptiveBitrateConfig;
    updateCounselorStatusWithGatekeeper(request: CounselorStatusRequest): Promise<{
        success: boolean;
        message: string;
        quality?: never;
    } | {
        success: boolean;
        message: string;
        quality: NetworkQuality;
    }>;
    setLiteMode(userId: string, enabled: boolean): Promise<void>;
    getLiteMode(userId: string): Promise<boolean>;
}
export declare const gatekeeperService: GatekeeperService;
//# sourceMappingURL=gatekeeper.service.d.ts.map