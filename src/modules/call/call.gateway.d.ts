import { Server, Socket } from 'socket.io';
export declare class CallGateway {
    server: Server;
    private pendingCalls;
    private prisma;
    handleCall(data: {
        userId: string;
    }, client: Socket): Promise<void>;
}
export declare const callGatewaySingleton: CallGateway;
//# sourceMappingURL=call.gateway.d.ts.map