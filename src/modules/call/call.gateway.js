"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGatewaySingleton = exports.CallGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
let CallGateway = class CallGateway {
    server;
    pendingCalls = new Map();
    prisma = new client_1.PrismaClient();
    async handleCall(data, client) {
        const { userId } = data;
        // 유저 잔액 확인
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.goldBalance < 15) {
            client.emit('callError', { message: '잔액이 부족합니다' });
            return;
        }
        // 대기열에 추가 (10초 릴레이 구조)
        this.pendingCalls.set(userId, { userId, timestamp: Date.now() });
        client.emit('callPending', { message: '상담사 연결 대기 중입니다.' });
        // 실제 릴레이 로직은 추후 구현
    }
};
exports.CallGateway = CallGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], CallGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('handleCall'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], CallGateway.prototype, "handleCall", null);
exports.CallGateway = CallGateway = __decorate([
    (0, websockets_1.WebSocketGateway)()
], CallGateway);
// 싱글턴 인스턴스 export
exports.callGatewaySingleton = new CallGateway();
//# sourceMappingURL=call.gateway.js.map