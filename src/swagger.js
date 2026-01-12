"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = setupSwagger;
const swagger_1 = require("@nestjs/swagger");
function setupSwagger(app) {
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Secret-Line API')
        .setDescription('Secret-Line 정산/비즈니스 API 문서')
        .setVersion('1.0')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, document, {
        customCssUrl: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css',
        customJs: [
            'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js',
            'https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js'
        ]
    });
}
//# sourceMappingURL=swagger.js.map