import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('');

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('Secret-Line API')
    .setDescription('Secret-Line 정산/비즈니스 API 문서')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.15.5/swagger-ui.css',
    customJs: [
      'https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.15.5/swagger-ui-bundle.js',
      'https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js'
    ]
  });

  const port = process.env.PORT || 3000;
  // Prisma 연결 지연 방지
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
  } catch (err) {
    console.warn('Prisma 연결 실패, 서버는 계속 실행됩니다:', err);
  }
  await app.listen(port);
  console.log(`\n🚀 Secret-Line API Server running on: http://localhost:${port}`);
  console.log(`📚 Swagger API Docs: http://localhost:${port}/api`);
}
bootstrap();
