"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndExit = validateAndExit;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function validateAndExit() {
    console.log('🔍 Validating environment variables...');
    const required = ['DATABASE_URL', 'REDIS_HOST', 'REDIS_PORT', 'AGORA_APP_ID', 'AGORA_APP_CERTIFICATE', 'PAYMENT_WEBHOOK_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing.join(', '));
        process.exit(1);
    }
    console.log('✅ All required environment variables are set!');
}
if (require.main === module) {
    validateAndExit();
}
//# sourceMappingURL=env-validator.js.map