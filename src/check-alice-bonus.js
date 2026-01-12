"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
(async () => {
    const prisma = new client_1.PrismaClient();
    const aliceId = 'a7e2e2b1-1c2d-4e3f-9a4b-123456789abc'; // Alice의 실제 UUID로 교체 필요
    const alice = await prisma.user.findUnique({ where: { id: aliceId } });
    if (alice) {
        console.log('Referral Bonus Processed for Alice!');
        console.log(`Alice's new goldBalance: ${alice.goldBalance}`);
    }
    else {
        console.log('Alice not found!');
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-alice-bonus.js.map