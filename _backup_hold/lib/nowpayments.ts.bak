/**
 * NOWPayments API 클라이언트
 * 결제 생성 및 웹훅 검증
 */

const NOWPAYMENTS_API_BASE = process.env.NOWPAYMENTS_SANDBOX === 'true'
  ? 'https://api-sandbox.nowpayments.io/v1'
  : 'https://api.nowpayments.io/v1';

/**
 * NOWPayments API 요청 헤더 생성
 */
function getHeaders() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error('NOWPayments API key is not configured');
  }
  return {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * 결제 생성
 * @param amount 결제 금액
 * @param currency 통화 (기본값: USD)
 * @param orderId 주문 ID
 * @param customerEmail 고객 이메일
 * @returns 결제 정보
 */
export async function createPayment(
  amount: number,
  currency: string = 'USD',
  orderId: string,
  customerEmail?: string
) {
  const response = await fetch(`${NOWPAYMENTS_API_BASE}/payment`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      price_amount: amount,
      price_currency: currency,
      pay_currency: 'btc', // 기본값, 실제로는 동적으로 선택 가능
      order_id: orderId,
      order_description: `Secret Line 통화료 결제 - ${orderId}`,
      ipn_callback_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/payments/callback`,
      success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payments/success`,
      cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payments/cancel`,
      customer_email: customerEmail,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`NOWPayments API error: ${error.message || 'Unknown error'}`);
  }

  return response.json();
}

/**
 * 결제 상태 조회
 * @param paymentId 결제 ID
 * @returns 결제 정보
 */
export async function getPaymentStatus(paymentId: string) {
  const response = await fetch(`${NOWPAYMENTS_API_BASE}/payment/${paymentId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch payment status');
  }

  return response.json();
}

/**
 * IPN 웹훅 서명 검증
 * @param payload 웹훅 페이로드
 * @param signature 서명
 * @returns 검증 성공 여부
 */
export function verifyIPNSignature(payload: any, signature: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    throw new Error('NOWPayments IPN secret is not configured');
  }

  // 실제 구현에서는 NOWPayments의 서명 검증 로직을 사용해야 합니다
  // 여기서는 기본 구조만 제공합니다
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha512', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}

