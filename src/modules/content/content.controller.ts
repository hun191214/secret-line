import { Router, Request, Response } from 'express';
import { contentService } from './content.service';

export class ContentController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post('/', this.createContent.bind(this));
    this.router.get('/', this.getContentList.bind(this));
    this.router.get('/:contentId', this.getContent.bind(this));
    this.router.post('/purchase/:contentId', this.purchaseContent.bind(this));
    this.router.get('/access/:contentId', this.checkAccess.bind(this));
  }

  private async createContent(req: Request, res: Response) {
    try {
      const content = await contentService.createSecretVoice(req.body);
      res.status(201).json({ success: true, data: content });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async getContentList(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const contents = await contentService.getSecretVoiceList(userId, req.query);
      res.status(200).json({ success: true, data: contents });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async getContent(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const contentId = req.params.contentId;
      if (!contentId || !userId) {
        res.status(400).json({ success: false, error: 'contentId와 userId는 필수입니다.' });
        return;
      }
      const content = await contentService.getSecretVoice(contentId, userId);
      res.status(200).json({ success: true, data: content });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  private async purchaseContent(req: Request, res: Response) {
    try {
      const contentId = req.params.contentId;
      const userId = req.body.userId;
      if (!contentId || !userId) {
        res.status(400).json({ success: false, error: 'contentId와 userId는 필수입니다.' });
        return;
      }
      const result = await contentService.purchaseContent(contentId, userId);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async checkAccess(req: Request, res: Response) {
    try {
      const contentId = req.params.contentId;
      const userId = req.query.userId as string;
      if (!contentId || !userId) {
        res.status(400).json({ success: false, error: 'contentId와 userId는 필수입니다.' });
        return;
      }
      const access = await contentService.checkContentAccess(contentId, userId);
      res.status(200).json({ success: true, data: access });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const contentRouter = new ContentController().router;
