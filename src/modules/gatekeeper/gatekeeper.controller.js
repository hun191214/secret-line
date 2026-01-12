"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatekeeperRouter = exports.GatekeeperController = void 0;
const express_1 = require("express");
const gatekeeper_service_1 = require("./gatekeeper.service");
class GatekeeperController {
    router;
    constructor() { this.router = (0, express_1.Router)(); this.initializeRoutes(); }
    initializeRoutes() {
        this.router.post('/validate', this.validateNetwork.bind(this));
        this.router.post('/counselor/status', this.updateCounselorStatus.bind(this));
        this.router.post('/lite-mode', this.setLiteMode.bind(this));
        this.router.get('/lite-mode/:userId', this.getLiteMode.bind(this));
    }
    async validateNetwork(req, res) {
        const result = await gatekeeper_service_1.gatekeeperService.validateNetworkQuality(req.body.counselorId, req.body.metrics);
        res.status(result.passed ? 200 : 403).json({ success: result.passed, data: result });
    }
    async updateCounselorStatus(req, res) {
        const result = await gatekeeper_service_1.gatekeeperService.updateCounselorStatusWithGatekeeper(req.body);
        res.status(result.success ? 200 : 403).json(result);
    }
    async setLiteMode(req, res) {
        await gatekeeper_service_1.gatekeeperService.setLiteMode(req.body.userId, req.body.enabled);
        res.status(200).json({ success: true, message: '저사양 모드 설정 변경 완료' });
    }
    async getLiteMode(req, res) {
        const userId = req.params.userId;
        if (!userId) {
            res.status(400).json({ success: false, error: 'userId는 필수입니다.' });
            return;
        }
        const isLiteMode = await gatekeeper_service_1.gatekeeperService.getLiteMode(userId);
        res.status(200).json({ success: true, data: { isLiteMode } });
    }
}
exports.GatekeeperController = GatekeeperController;
exports.gatekeeperRouter = new GatekeeperController().router;
//# sourceMappingURL=gatekeeper.controller.js.map