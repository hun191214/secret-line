
import { NestFactory } from '@nestjs/core';
import { setupSwagger } from './swagger';

export async function createNestServer(AppModule: any) {
  const app = await NestFactory.create(AppModule);
  // 글로벌 프리픽스를 'api'로 설정
  app.setGlobalPrefix('api');

  // Swagger 설정 함수가 있다면 호출
  if (typeof setupSwagger === 'function') {
    setupSwagger(app);
  }

  await app.init();
  return app;
}
