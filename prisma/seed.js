"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Prisma v7+ 표준: 환경 변수만 사용, 인자 없이 생성
require("dotenv/config");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🚀 Starting Database Seeding...');
    const ref = await prisma.user.upsert({
        where: { nickname: 'referrer_alice' }, update: {},
        create: { nickname: 'referrer_alice', role: client_1.Role.USER, goldBalance: 50000, crownLevel: client_1.CrownLevel.BRONZE },
    });
    await prisma.user.upsert({
        where: { nickname: 'test_user_bob' }, update: {},
        create: { nickname: 'test_user_bob', role: client_1.Role.USER, goldBalance: 500000, crownLevel: client_1.CrownLevel.BRONZE, referrerId: ref.id },
    });
    await prisma.user.upsert({
        where: { nickname: 'counselor_joy' }, update: {},
        create: { nickname: 'counselor_joy', role: client_1.Role.COUNSELOR, goldBalance: 100000, crownLevel: client_1.CrownLevel.SILVER, referrerId: ref.id },
    });
    console.log('✨ [Victory] Seed Successful!');
}
main().catch(console.error).finally(async () => { await prisma.$disconnect(); });
//# sourceMappingURL=seed.js.map