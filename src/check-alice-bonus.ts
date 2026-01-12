import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  const aliceId = 'a7e2e2b1-1c2d-4e3f-9a4b-123456789abc'; // Alice의 실제 UUID로 교체 필요
  const alice = await prisma.user.findUnique({ where: { id: aliceId } });
  if (alice) {
    console.log('Referral Bonus Processed for Alice!');
    console.log(`Alice's new goldBalance: ${alice.goldBalance}`);
  } else {
    console.log('Alice not found!');
  }
  await prisma.$disconnect();
})();
