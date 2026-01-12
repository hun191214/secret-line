"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentRouter = exports.ContentController = void 0;
const express_1 = require("express");
const content_service_1 = require("./content.service");
class ContentController {
    router;
    constructor() {
        this.router = (0, express_1.Router)();
        this.initializeRoutes();
    }
    initializeRoutes() {
        this.router.post('/', this.createContent.bind(this));
        this.router.get('/', this.getContentList.bind(this));
        this.router.get('/:contentId', this.getContent.bind(this));
        this.router.post('/purchase/:contentId', this.purchaseContent.bind(this));
        this.router.get('/access/:contentId', this.checkAccess.bind(this));
    }
    async createContent(req, res) {
        try {
            const content = await content_service_1.contentService.createSecretVoice(req.body);
            res.status(201).json({ success: true, data: content });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getContentList(req, res) {
        try {
            const userId = req.headers['x-user-id'];
            const contents = await content_service_1.contentService.getSecretVoiceList(userId, req.query);
            res.status(200).json({ success: true, data: contents });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getContent(req, res) {
        try {
            const userId = req.headers['x-user-id'];
            const contentId = req.params.contentId;
            if (!contentId || !userId) {
                res.status(400).json({ success: false, error: 'contentId와 userId는 필수입니다.' });
                return;
            }
            const content = await content_service_1.contentService.getSecretVoice(contentId, userId);
            res.status(200).json({ success: true, data: content });
        }
        catch (error) {
            res.status(404).json({ success: false, error: error.message });
        }
    }
    async purchaseContent(req, res) {
        try {
            const contentId = req.params.contentId;
            const userId = req.body.userId;
            if (!contentId || !userId) {
                res.status(400).json({ success: false, error: 'contentId와 userId는 필수입니다.' });
                return;
            }
            const result = await content_service_1.contentService.purchaseContent(contentId, userId);
            res.status(result.success ? 200 : 400).json(result);
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async checkAccess(req, res) {
        try {
            const contentId = req.params.contentId;
            const userId = req.query.userId;
            if (!contentId || !userId) {
                res.status(400).json({ success: false, error: 'contentId와 userId는 필수입니다.' });
                return;
            }
            const access = await content_service_1.contentService.checkContentAccess(contentId, userId);
            res.status(200).json({ success: true, data: access });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
exports.ContentController = ContentController;
exports.contentRouter = new ContentController().router;
//# sourceMappingURL=content.controller.js.map