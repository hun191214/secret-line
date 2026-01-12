

import { PrismaClient, Role, CrownLevel } from '@prisma/client';

// Prisma v7+ 표준: 환경 변수만 사용, 인자 없이 생성
import 'dotenv/config';
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Database Seeding...');
  const ref = await prisma.user.upsert({
    where: { nickname: 'referrer_alice' }, update: {},
    create: { nickname: 'referrer_alice', role: Role.USER, goldBalance: 50000, crownLevel: CrownLevel.BRONZE },
  });
  await prisma.user.upsert({
    where: { nickname: 'test_user_bob' }, update: {},
    create: { nickname: 'test_user_bob', role: Role.USER, goldBalance: 500000, crownLevel: CrownLevel.BRONZE, referrerId: ref.id },
  });
  await prisma.user.upsert({
    where: { nickname: 'counselor_joy' }, update: {},
    create: { nickname: 'counselor_joy', role: Role.COUNSELOR, goldBalance: 100000, crownLevel: CrownLevel.SILVER, referrerId: ref.id },
  });
  console.log('✨ [Victory] Seed Successful!');
}
main().catch(console.error).finally(async () => { await prisma.$disconnect(); });