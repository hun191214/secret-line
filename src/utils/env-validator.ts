import dotenv from 'dotenv';
dotenv.config();

export function validateAndExit(): void {
  console.log('🔍 Validating environment variables...');
  const required = ['DATABASE_URL', 'REDIS_HOST', 'REDIS_PORT', 'AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'PAYMENT_WEBHOOK_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ All required environment variables are set!');
}

if (require.main === module) { validateAndExit(); }
