import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  const joyId = 'c7a609b5-e6dd-403f-971f-afce5ccbdc89';

  // 프리미엄 시크릿 보이스 등록
  const premium = await prisma.secretVoice.create({
    data: {
      creatorId: joyId,
      title: '프리미엄 시크릿 보이스',
      audioUrl: 'https://cdn.secret-line.com/premium-secret.mp3',
      price: 1000,
      duration: 60,
      isActive: true,
    },
  });
  console.log('프리미엄 시크릿 보이스 등록 완료:', premium.id);
  await prisma.$disconnect();
})();
