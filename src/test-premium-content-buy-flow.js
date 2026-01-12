"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const content_service_1 = require("./modules/content/content.service");
const client_1 = require("@prisma/client");
(async () => {
    const prisma = new client_1.PrismaClient();
    const joyId = 'c7a609b5-e6dd-403f-971f-afce5ccbdc89';
    const bobId = 'f2caa1a1-3af0-4c60-b0b1-84248fb3ec7a';
    const aliceId = '4b5c3f9d-d983-498f-a347-d8d8d7368ab1';
    const operatorId = 'operator';
    // 프리미엄 시크릿 보이스 찾기
    const voice = await prisma.secretVoice.findFirst({ where: { creatorId: joyId, title: '프리미엄 시크릿 보이스' } });
    if (!voice)
        throw new Error('프리미엄 시크릿 보이스가 없습니다.');
    // 구매 전 잔액
    const bobBefore = await prisma.user.findUnique({ where: { id: bobId } });
    const joyBefore = await prisma.user.findUnique({ where: { id: joyId } });
    const aliceBefore = await prisma.user.findUnique({ where: { id: aliceId } });
    const operatorBefore = await prisma.user.findUnique({ where: { id: operatorId } });
    // Bob이 프리미엄 보이스 구매
    const result = await content_service_1.contentService.purchaseContent(voice.id, bobId);
    console.log('구매 결과:', result.success ? '신비로운 목소리가 당신의 비밀 갤러리에 저장되었습니다.' : result.error);
    // 구매 후 잔액
    const bobAfter = await prisma.user.findUnique({ where: { id: bobId } });
    const joyAfter = await prisma.user.findUnique({ where: { id: joyId } });
    const aliceAfter = await prisma.user.findUnique({ where: { id: aliceId } });
    const operatorAfter = await prisma.user.findUnique({ where: { id: operatorId } });
    // 표 출력
    console.log('\n--- 잔액 변화 표 ---');
    console.log('| 유저      | 구매 전 | 구매 후 | 변동 |');
    console.log('|-----------|--------|--------|------|');
    console.log(`| Bob       | ${bobBefore?.goldBalance} | ${bobAfter?.goldBalance} | ${(bobAfter?.goldBalance ?? 0) - (bobBefore?.goldBalance ?? 0)} |`);
    console.log(`| Joy       | ${joyBefore?.goldBalance} | ${joyAfter?.goldBalance} | ${(joyAfter?.goldBalance ?? 0) - (joyBefore?.goldBalance ?? 0)} |`);
    console.log(`| Alice(추천인) | ${aliceBefore?.goldBalance} | ${aliceAfter?.goldBalance} | ${(aliceAfter?.goldBalance ?? 0) - (aliceBefore?.goldBalance ?? 0)} |`);
    console.log(`| Operator  | ${operatorBefore?.goldBalance} | ${operatorAfter?.goldBalance} | ${(operatorAfter?.goldBalance ?? 0) - (operatorBefore?.goldBalance ?? 0)} |`);
    await prisma.$disconnect();
})();
//# sourceMappingURL=test-premium-content-buy-flow.js.map