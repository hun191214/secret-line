import { createClient } from 'redis';
declare let redisClient: ReturnType<typeof createClient> | null;
export declare const connectRedis: () => Promise<void>;
export default redisClient;
//# sourceMappingURL=redis.d.ts.map