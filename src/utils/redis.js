"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = void 0;
const redis_1 = require("redis");
let isRedisErrorLogged = false;
let isFirstError = true;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6373';
let redisClient = null;
try {
    redisClient = (0, redis_1.createClient)({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 0) {
                    return new Error('Redis connection failed. Stopping retries.');
                }
                return 2000;
            },
        },
    });
    // 에러가 밖으로 튀지 않게 가장 먼저 무시 핸들러 등록
    redisClient.on('error', () => { });
    // 한 번만 경고 로그
    let isFirstError = true;
    redisClient.on('error', () => {
        if (isFirstError) {
            console.warn('⚠️ Redis is not available. System will skip Redis features.');
            isFirstError = false;
        }
    });
}
catch (err) {
    console.error('Failed to initialize Redis client:', err);
    redisClient = null;
}
const connectRedis = async () => {
    if (!redisClient) {
        console.warn('Redis client not initialized. Skipping connection.');
        return;
    }
    try {
        if (!redisClient.isOpen)
            await redisClient.connect();
    }
    catch (err) {
        console.error('Redis connection failed:', err);
        // Do not throw, just log
    }
};
exports.connectRedis = connectRedis;
exports.default = redisClient;
//# sourceMappingURL=redis.js.map