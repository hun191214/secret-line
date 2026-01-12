"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = exports.PaymentService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || '';
class PaymentService {
    async handleWebhook(payload, signature) {
        // 1. 시크릿 검증
        const expectedSig = crypto_1.default.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
        if (signature !== expectedSig) {
            return { success: false, reason: 'Invalid signature' };
        }
        // 2. 결제 성공 처리
        const { userId, usdtAmount, providerTxId } = payload;
        if (!userId || !usdtAmount || !providerTxId) {
            return { success: false, reason: 'Missing required fields' };
        }
        // 3. 중복 결제 방지
        const exists = await prisma.paymentRecord.findUnique({ where: { providerTxId } });
        if (exists) {
            return { success: false, reason: 'Duplicate transaction' };
        }
        // 4. 골드 환산 및 충전
        const gold = Math.floor(usdtAmount * 100);
        await prisma.paymentRecord.create({
            data: {
                userId: String(userId),
                providerTxId: String(providerTxId),
                amount: Number(usdtAmount),
                currency: 'USDT',
                status: 'COMPLETED',
                estimatedGold: gold,
                provider: 'supabase',
            },
        });
        await prisma.user.update({ where: { id: userId }, data: { goldBalance: { increment: gold } } });
        return { success: true, goldCharged: gold };
    }
}
exports.PaymentService = PaymentService;
exports.paymentService = new PaymentService();
//# sourceMappingURL=payment.service.js.map