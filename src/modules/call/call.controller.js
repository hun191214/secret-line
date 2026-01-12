"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callRouter = exports.CallController = void 0;
const express_1 = require("express");
const call_service_1 = require("./call.service");
class CallController {
    router;
    constructor() {
        this.router = (0, express_1.Router)();
        this.initializeRoutes();
    }
    initializeRoutes() {
        this.router.post('/token', this.generateToken.bind(this));
        this.router.post('/validate', this.validateAccess.bind(this));
        this.router.post('/reserve', this.reserveCall.bind(this));
        this.router.post('/start/:reservationId', this.startCall.bind(this));
    }
    async generateToken(req, res) {
        try {
            const { userId, channelName, role = 'publisher' } = req.body;
            if (!userId || !channelName) {
                res.status(400).json({ success: false, error: 'userId와 channelName은 필수입니다.' });
                return;
            }
            const validation = await call_service_1.callService.validateCallAccess(userId);
            if (!validation.allowed) {
                res.status(403).json({ success: false, error: validation.reason });
                return;
            }
            const token = call_service_1.callService.generateAgoraToken({ userId, channelName, role });
            res.status(200).json({
                success: true,
                data: { token, channelName, userId, role, expiresIn: 3600 }
            });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : '서버 오류' });
        }
    }
    async validateAccess(req, res) {
        try {
            const { userId } = req.body;
            if (!userId) {
                res.status(400).json({ success: false, error: 'userId는 필수입니다.' });
                return;
            }
            const validation = await call_service_1.callService.validateCallAccess(userId);
            res.status(validation.allowed ? 200 : 403).json({ success: validation.allowed, data: validation });
        }
        catch (error) {
            res.status(500).json({ success: false, error: '서버 오류' });
        }
    }
    async reserveCall(req, res) {
        try {
            const { userId, counselorId } = req.body;
            if (!userId || !counselorId) {
                res.status(400).json({ success: false, error: 'userId와 counselorId는 필수입니다.' });
                return;
            }
            const reservation = await call_service_1.callService.reserveCallPayment(userId, counselorId);
            res.status(200).json({ success: true, data: reservation });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error instanceof Error ? error.message : '예약 오류' });
        }
    }
    async startCall(req, res) {
        try {
            const { reservationId } = req.params;
            if (!reservationId) {
                res.status(400).json({ success: false, error: 'reservationId가 유효하지 않습니다.' });
                return;
            }
            await call_service_1.callService.startCall(reservationId);
            res.status(200).json({ success: true, message: '통화가 시작되었습니다.' });
        }
        catch (error) {
            res.status(500).json({ success: false, error: '시작 오류' });
        }
    }
}
exports.CallController = CallController;
const callController = new CallController();
exports.callRouter = callController.router;
//# sourceMappingURL=call.controller.js.map