/**
 * File: backend/src/main.ts
 * Fungsi:
 *  - Entry point aplikasi NestJS.
 *  - Membuat instance Nest, memasang global middleware (helmet, cors,
 *    compression, cookie-parser), global pipe (ValidationPipe),
 *    global filter (AllExceptionsFilter), global interceptor
 *    (ResponseInterceptor), prefix API, dan setup Swagger.
 *  - Menjalankan HTTP server pada port dari environment.
 */

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

/**
 * bootstrap()
 * Fungsi utama untuk mem-bootstrap aplikasi NestJS:
 *  1. Membuat Nest application.
 *  2. Membaca konfigurasi dari ConfigService.
 *  3. Memasang middleware keamanan & utilitas.
 *  4. Memasang global pipe/filter/interceptor.
 *  5. Mendaftarkan Swagger jika diaktifkan.
 *  6. Menjalankan listener HTTP.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  // --- Konfigurasi dasar dari env ---
  const port = Number(config.get<string>('APP_PORT') ?? 3000);
  const globalPrefix = config.get<string>('APP_GLOBAL_PREFIX') ?? 'api';
  const apiVersion = (config.get<string>('APP_API_VERSION') ?? 'v1').replace(/^v/i, '');
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // --- Middleware keamanan & utilitas ---
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  // --- Prefix & versioning REST API: /api/v1/... ---
  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });

  // --- Validasi DTO otomatis untuk semua request ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // hapus property yang tidak ada di DTO
      forbidNonWhitelisted: true, // tolak jika ada property asing
      transform: true, // ubah payload menjadi instance DTO
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- Global filter & interceptor untuk format response standar ---
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // --- Swagger ---
  const swaggerEnabled = (config.get<string>('SWAGGER_ENABLED') ?? 'true') === 'true';
  if (swaggerEnabled) {
    const swaggerPath = config.get<string>('SWAGGER_PATH') ?? 'docs';
    const swaggerConfig = new DocumentBuilder()
      .setTitle(config.get<string>('SWAGGER_TITLE') ?? 'Bursa Kerja Digital API')
      .setDescription(
        config.get<string>('SWAGGER_DESCRIPTION') ?? 'Dokumentasi REST API Bursa Kerja Digital',
      )
      .setVersion(config.get<string>('SWAGGER_VERSION') ?? '1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 Backend running on http://localhost:${port}/${globalPrefix}/v${apiVersion}`);
}

void bootstrap();
