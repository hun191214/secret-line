"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const profit_service_1 = require("./modules/profit/profit.service");
const client_1 = require("@prisma/client");
(async () => {
    const prisma = new client_1.PrismaClient();
    const payerId = 'f2caa1a1-3af0-4c60-b0b1-84248fb3ec7a'; // Bob
    const payeeId = 'c7a609b5-e6dd-403f-971f-afce5ccbdc89'; // Joy
    const amount = 10000;
    const type = 'CONSULTATION';
    const result = await profit_service_1.profitService.settleTransaction({
        payerId,
        payeeId,
        amount,
        type,
    });
    console.log('Settlement complete! Checking Bob\'s new rank...');
    const bob = await prisma.user.findUnique({ where: { id: payerId } });
    if (bob) {
        console.log(`Bob's new crown level: ${bob.crownLevel}`);
        console.log(`Bob's accumulatedSpend: ${bob.accumulatedSpend}`);
    }
    else {
        console.log('Bob not found!');
    }
    // Alice의 실제 ID로 잔액 확인
    const aliceId = '4b5c3f9d-d983-498f-a347-d8d8d7368ab1';
    const alice = await prisma.user.findUnique({ where: { id: aliceId } });
    if (alice) {
        console.log(`Alice balance verified: ${alice.goldBalance} Gold`);
    }
    else {
        console.log('Alice not found!');
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=test-final-flow.js.map