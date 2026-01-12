
import { contentService } from './modules/content/content.service';
import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  const joyId = 'c7a609b5-e6dd-403f-971f-afce5ccbdc89';
  const bobId = 'f2caa1a1-3af0-4c60-b0b1-84248fb3ec7a';
  const aliceId = '4b5c3f9d-d983-498f-a347-d8d8d7368ab1';

  // 1. Joy의 SecretVoice 등록 (이미 등록된 경우 생략)
  let voice = await prisma.secretVoice.findFirst({ where: { creatorId: joyId, title: '한밤중의 속삭임' } });
  if (!voice) {
    voice = await prisma.secretVoice.create({
      data: {
        creatorId: joyId,
        title: '한밤중의 속삭임',
        audioUrl: 'https://cdn.secret-line.com/sample-midnight.mp3',
        price: 15,
        duration: 30,
        isActive: true,
      },
    });
    console.log('SecretVoice 등록 완료:', voice.id);
  } else {
    console.log('이미 등록된 SecretVoice:', voice.id);
  }

  // 2. 구매 전 잔액/수익 확인
  const bobBefore = await prisma.user.findUnique({ where: { id: bobId } });
  const joyBefore = await prisma.user.findUnique({ where: { id: joyId } });
  const aliceBefore = await prisma.user.findUnique({ where: { id: aliceId } });

  // 3. Bob이 Joy의 목소리 구매
  const result = await contentService.purchaseContent(voice.id, bobId);
  console.log('구매 결과:', result.success ? '신비로운 목소리가 당신의 비밀 갤러리에 저장되었습니다.' : result.error);

  // 4. 구매 후 잔액/수익 확인
  const bobAfter = await prisma.user.findUnique({ where: { id: bobId } });
  const joyAfter = await prisma.user.findUnique({ where: { id: joyId } });
  const aliceAfter = await prisma.user.findUnique({ where: { id: aliceId } });

  // 5. 결과 리포트
  console.log('--- 결과 리포트 ---');
  console.log(`Bob: ${bobBefore?.goldBalance} → ${bobAfter?.goldBalance} (변동: ${(bobAfter?.goldBalance ?? 0) - (bobBefore?.goldBalance ?? 0)})`);
  console.log(`Joy: ${joyBefore?.goldBalance} → ${joyAfter?.goldBalance} (변동: ${(joyAfter?.goldBalance ?? 0) - (joyBefore?.goldBalance ?? 0)})`);
  console.log(`Alice(추천인): ${aliceBefore?.goldBalance} → ${aliceAfter?.goldBalance} (변동: ${(aliceAfter?.goldBalance ?? 0) - (aliceBefore?.goldBalance ?? 0)})`);

  await prisma.$disconnect();
})();
