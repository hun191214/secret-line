import { Router, Request, Response } from 'express';
import { callService } from './call.service';

interface GenerateTokenRequest {
  userId: string;
  channelName: string;
  role?: 'publisher' | 'subscriber';
}

interface ReserveCallRequest {
  userId: string;
  counselorId: string;
}

export class CallController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post('/token', this.generateToken.bind(this));
    this.router.post('/validate', this.validateAccess.bind(this));
    this.router.post('/reserve', this.reserveCall.bind(this));
    this.router.post('/start/:reservationId', this.startCall.bind(this));
  }

  private async generateToken(req: Request, res: Response): Promise<void> {
    try {
      const { userId, channelName, role = 'publisher' } = req.body as GenerateTokenRequest;
      if (!userId || !channelName) {
        res.status(400).json({ success: false, error: 'userId와 channelName은 필수입니다.' });
        return;
      }
      const validation = await callService.validateCallAccess(userId);
      if (!validation.allowed) {
        res.status(403).json({ success: false, error: validation.reason });
        return;
      }
      const token = callService.generateAgoraToken({ userId, channelName, role });
      res.status(200).json({
        success: true,
        data: { token, channelName, userId, role, expiresIn: 3600 }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : '서버 오류' });
    }
  }

  private async validateAccess(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({ success: false, error: 'userId는 필수입니다.' });
        return;
      }
      const validation = await callService.validateCallAccess(userId);
      res.status(validation.allowed ? 200 : 403).json({ success: validation.allowed, data: validation });
    } catch (error) {
      res.status(500).json({ success: false, error: '서버 오류' });
    }
  }

  private async reserveCall(req: Request, res: Response): Promise<void> {
    try {
      const { userId, counselorId } = req.body as ReserveCallRequest;
      if (!userId || !counselorId) {
        res.status(400).json({ success: false, error: 'userId와 counselorId는 필수입니다.' });
        return;
      }
      const reservation = await callService.reserveCallPayment(userId, counselorId);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : '예약 오류' });
    }
  }

  private async startCall(req: Request, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;

      if (!reservationId) {
        res.status(400).json({ success: false, error: 'reservationId가 유효하지 않습니다.' });
        return;
      }

      await callService.startCall(reservationId);
      res.status(200).json({ success: true, message: '통화가 시작되었습니다.' });
    } catch (error) {
      res.status(500).json({ success: false, error: '시작 오류' });
    }
  }
}

const callController = new CallController();
export const callRouter = callController.router;
