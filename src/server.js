"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNestServer = createNestServer;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("./swagger");
async function createNestServer() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    (0, swagger_1.setupSwagger)(app);
    await app.init();
    return app;
}
//# sourceMappingURL=server.js.map