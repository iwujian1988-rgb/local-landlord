import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync } from 'fs';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();

  // 静态文件服务（上传的文件）
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // 全局管道
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // 全局过滤器
  app.useGlobalFilters(new AllExceptionsFilter());

  // 全局拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  if (process.env.NODE_ENV === 'production') {
    const adminDist = join(__dirname, '..', 'public');
    if (existsSync(adminDist)) {
      (app as NestExpressApplication).useStaticAssets(adminDist, { prefix: '/' });
    }
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
