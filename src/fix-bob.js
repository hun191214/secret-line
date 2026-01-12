"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const user_service_1 = require("./modules/user/user.service");
(async () => {
    const prisma = new client_1.PrismaClient();
    const userId = 'f2caa1a1-3af0-4c60-b0b1-84248fb3ec7a';
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.error('Bob not found!');
        await prisma.$disconnect();
        process.exit(1);
    }
    const result = await user_service_1.userService.updateUserCrownLevel(userId);
    if (result.newLevel === 'PLATINUM') {
        console.log('Bob is finally PLATINUM!');
    }
    else {
        console.log(`Bob is now ${result.newLevel}`);
    }
    await prisma.$disconnect();
})();
//# sourceMappingURL=fix-bob.js.map