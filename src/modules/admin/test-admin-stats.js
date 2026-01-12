"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin_service_1 = require("./admin.service");
(async () => {
    const stats = await admin_service_1.adminService.getStats();
    console.log('[AdminService.getStats 샘플 리턴]', stats);
    const idleList = await admin_service_1.adminService.getIdleCounselorList();
    console.log('[대기 중 상담사 리스트]', idleList);
})();
//# sourceMappingURL=test-admin-stats.js.map