import { userService } from './modules/user/user.service';

(async () => {
  const userId = 'f2caa1a1-3af0-4c60-b0b...'; // Bob의 실제 UUID로 교체 필요
  const newLevel = await userService.updateUserCrownLevel(userId);
  console.log(`Bob의 새로운 등급: ${newLevel}`);
  process.exit(0);
})();
