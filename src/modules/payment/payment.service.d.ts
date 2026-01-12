export declare class PaymentService {
    handleWebhook(payload: any, signature: string): Promise<{
        success: boolean;
        goldCharged?: number;
        reason?: string;
    }>;
}
export declare const paymentService: PaymentService;
//# sourceMappingURL=payment.service.d.ts.map