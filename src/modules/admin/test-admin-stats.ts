import { adminService } from './admin.service';

(async () => {
  const stats = await adminService.getStats();
  console.log('[AdminService.getStats 샘플 리턴]', stats);

  const idleList = await adminService.getIdleCounselorList();
  console.log('[대기 중 상담사 리스트]', idleList);
})();
