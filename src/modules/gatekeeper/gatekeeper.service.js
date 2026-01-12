"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatekeeperService = exports.GatekeeperService = exports.NetworkQuality = void 0;
exports.getLiteModeConfig = getLiteModeConfig;
// Lite Mode 실체화: 오디오 비트레이트 최저, 애니메이션 시그널 생략
function getLiteModeConfig() {
    return { audioBitrate: 24, skipAnimation: true };
}
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
var NetworkQuality;
(function (NetworkQuality) {
    NetworkQuality["EXCELLENT"] = "EXCELLENT";
    NetworkQuality["GOOD"] = "GOOD";
    NetworkQuality["FAIR"] = "FAIR";
    NetworkQuality["POOR"] = "POOR";
})(NetworkQuality || (exports.NetworkQuality = NetworkQuality = {}));
class GatekeeperService {
    prisma;
    redis;
    QUALITY_THRESHOLDS = { EXCELLENT: { latency: 100, jitter: 15 }, GOOD: { latency: 200, jitter: 30 }, FAIR: { latency: 300, jitter: 50 } };
    MIN_QUALITY_FOR_IDLE = NetworkQuality.GOOD;
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || '',
        });
        // 에러가 밖으로 튀지 않게 무조건 빈 함수로 잡아버림
        this.redis.on('error', () => { });
    }
    async validateNetworkQuality(counselorId, metrics) {
        const quality = this.calculateNetworkQuality(metrics);
        const passed = this.isQualityAcceptable(quality);
        await this.cacheNetworkMetrics(counselorId, metrics, quality);
        // 품질 미달 시 EVENT_NETWORK_GUIDE 소켓 이벤트 발송
        if (!passed) {
            // Socket.io 인스턴스 가져오기 (CallGateway 싱글턴)
            try {
                const { callGatewaySingleton } = await Promise.resolve().then(() => __importStar(require('../call/call.gateway')));
                if (callGatewaySingleton.server) {
                    callGatewaySingleton.server.to(counselorId).emit('EVENT_NETWORK_GUIDE', {
                        message: '현재 네트워크가 불안정합니다. Wi-Fi로 전환하거나 위치를 이동하여 품질을 개선해 주세요.'
                    });
                }
            }
            catch (e) {
                // 소켓 서버 접근 실패 시 무시
            }
        }
        return { passed, quality, metrics, message: passed ? '품질 우수' : '품질 미달' };
    }
    calculateNetworkQuality(metrics) {
        const { latency, jitter } = metrics;
        if (latency < 100 && jitter < 15)
            return NetworkQuality.EXCELLENT;
        if (latency < 200 && jitter < 30)
            return NetworkQuality.GOOD;
        if (latency < 300 && jitter < 50)
            return NetworkQuality.FAIR;
        return NetworkQuality.POOR;
    }
    isQualityAcceptable(quality) {
        return [NetworkQuality.GOOD, NetworkQuality.EXCELLENT].includes(quality);
    }
    async cacheNetworkMetrics(counselorId, metrics, quality) {
        await this.redis.setex(`network:${counselorId}`, 300, JSON.stringify({ metrics, quality, timestamp: Date.now() }));
    }
    getAdaptiveBitrateConfig(quality, isLiteMode = false) {
        if (isLiteMode)
            return { quality: NetworkQuality.FAIR, audioBitrate: 24, videoEnabled: false, sampleRate: 16000, channelCount: 1 };
        if (quality === NetworkQuality.EXCELLENT)
            return { quality, audioBitrate: 128, videoEnabled: true, sampleRate: 48000, channelCount: 2 };
        return { quality: NetworkQuality.GOOD, audioBitrate: 64, videoEnabled: false, sampleRate: 48000, channelCount: 2 };
    }
    async updateCounselorStatusWithGatekeeper(request) {
        const { counselorId, targetStatus, networkMetrics } = request;
        if (targetStatus === 'IDLE' && networkMetrics) {
            const validation = await this.validateNetworkQuality(counselorId, networkMetrics);
            if (!validation.passed)
                return { success: false, message: validation.message };
            await this.redis.setex(`counselor:status:${counselorId}`, 3600, 'IDLE');
            return { success: true, message: 'IDLE 전환 성공', quality: validation.quality };
        }
        await this.redis.setex(`counselor:status:${counselorId}`, 3600, targetStatus);
        return { success: true, message: `${targetStatus} 전환 완료` };
    }
    async setLiteMode(userId, enabled) {
        await this.prisma.user.update({ where: { id: userId }, data: { isLiteMode: enabled } });
    }
    async getLiteMode(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isLiteMode: true } });
        return user?.isLiteMode || false;
    }
}
exports.GatekeeperService = GatekeeperService;
exports.gatekeeperService = new GatekeeperService();
//# sourceMappingURL=gatekeeper.service.js.map