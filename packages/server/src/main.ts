import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { existsSync } from 'fs';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Default express.json limit is 100kb, but image base64 uploads easily exceed
  // that (a 256KB photo becomes ~340KB base64, ~450KB after JSON wrapping).
  // Match MAX_UPLOAD_BYTES (10MB) so /upload/base64 doesn't 500 on real photos.
  app.useBodyParser('json', { limit: '10mb' });

  app.enableShutdownHooks();

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || false,
    credentials: true,
  });

  // Static file serving (uploaded files)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      // Without exceptionFactory, class-validator failures combined with
      // transform:true can surface as 500 instead of 400 — masking the real
      // "which field violated which rule" detail from clients. Return a
      // structured 400 with per-field constraints so the miniapp can show
      // the user exactly what went wrong.
      exceptionFactory: (errors) => {
        const details = errors
          .map((e) => {
            const constraints = e.constraints ? Object.values(e.constraints) : ['invalid'];
            return `${e.property}: ${constraints.join('; ')}`;
          })
          .join(' | ');
        return new BadRequestException(
          `参数校验失败 - ${details || 'unknown field error'}`,
        );
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  if (process.env.NODE_ENV === 'production') {
    const adminDist = join(__dirname, '..', 'public');
    if (existsSync(adminDist)) {
      (app as NestExpressApplication).useStaticAssets(adminDist, { prefix: '/' });
    }
  }
  // H5 bill page (served from packages/h5 build output, copied into public/h5)
  const h5Dist = join(__dirname, '..', 'public', 'h5');
  if (!existsSync(h5Dist)) {
    // dev fallback: cwd/public/h5
  }
  if (existsSync(h5Dist)) {
    (app as NestExpressApplication).useStaticAssets(h5Dist, { prefix: '/h5/' });
  } else {
    const h5Dev = join(process.cwd(), 'public', 'h5');
    if (existsSync(h5Dev)) {
      (app as NestExpressApplication).useStaticAssets(h5Dev, { prefix: '/h5/' });
    }
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
}
bootstrap();
