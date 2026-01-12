import { Router, Request, Response } from 'express';
import { gatekeeperService } from './gatekeeper.service';

export class GatekeeperController {
  public router: Router;
  constructor() { this.router = Router(); this.initializeRoutes(); }

  private initializeRoutes(): void {
    this.router.post('/validate', this.validateNetwork.bind(this));
    this.router.post('/counselor/status', this.updateCounselorStatus.bind(this));
    this.router.post('/lite-mode', this.setLiteMode.bind(this));
    this.router.get('/lite-mode/:userId', this.getLiteMode.bind(this));
  }

  private async validateNetwork(req: Request, res: Response) {
    const result = await gatekeeperService.validateNetworkQuality(req.body.counselorId, req.body.metrics);
    res.status(result.passed ? 200 : 403).json({ success: result.passed, data: result });
  }

  private async updateCounselorStatus(req: Request, res: Response) {
    const result = await gatekeeperService.updateCounselorStatusWithGatekeeper(req.body);
    res.status(result.success ? 200 : 403).json(result);
  }

  private async setLiteMode(req: Request, res: Response) {
    await gatekeeperService.setLiteMode(req.body.userId, req.body.enabled);
    res.status(200).json({ success: true, message: '저사양 모드 설정 변경 완료' });
  }

  private async getLiteMode(req: Request, res: Response) {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId는 필수입니다.' });
      return;
    }
    const isLiteMode = await gatekeeperService.getLiteMode(userId);
    res.status(200).json({ success: true, data: { isLiteMode } });
  }
}

export const gatekeeperRouter = new GatekeeperController().router;
