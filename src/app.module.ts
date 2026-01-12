import { Module } from '@nestjs/common';
import { CallModule } from './modules/call/call.module';
import { AppController } from './app.controller';

@Module({
  imports: [CallModule],
  controllers: [AppController],
})
export class AppModule {}
