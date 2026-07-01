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

import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validateEnv } from './common/utils/env-validation';

async function bootstrap(): Promise<void> {
  // Fail-fast validasi ENV sebelum Nest boot.
  validateEnv(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false, // di-pasang manual dgn limit ketat di bawah
  });

  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  // --- Basis env ---
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const isProd = nodeEnv === 'production';
  const port = Number(config.get<string>('APP_PORT') ?? 3000);
  const globalPrefix = config.get<string>('APP_GLOBAL_PREFIX') ?? 'api';
  const apiVersion = (config.get<string>('APP_API_VERSION') ?? 'v1').replace(/^v/i, '');
  const bodyLimit = config.get<string>('BODY_SIZE_LIMIT') ?? '1mb';
  const corsRaw = (config.get<string>('CORS_ORIGINS') ?? '').trim();
  const corsOrigins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
  const trustProxy = (config.get<string>('TRUST_PROXY') ?? '1'); // "loopback"/"1"/"true"

  // --- Trust proxy (untuk IP asli dari reverse-proxy / CDN) ---
  app.set('trust proxy', trustProxy === 'true' ? true : trustProxy);
  app.disable('x-powered-by');
  app.disable('etag'); // hindari cache leaking pada API JSON

  // --- Middleware keamanan HTTP ---
  app.use(
    helmet({
      // API JSON: tidak perlu CSP default (dan sering bentrok dgn Swagger UI).
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'"],
              'img-src': ["'self'", 'data:', 'blob:'],
              'style-src': ["'self'", "'unsafe-inline'"],
              'connect-src': ["'self'"],
              'frame-ancestors': ["'none'"],
              'object-src': ["'none'"],
              'base-uri': ["'self'"],
              'form-action': ["'self'"],
              // Kirim laporan pelanggaran CSP ke endpoint internal.
              'report-uri': ['/api/v1/csp-report'],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false, // izinkan Swagger UI
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      noSniff: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );

  // --- Body parser dengan LIMIT ketat (default 1MB) ---
  const express = require('express') as typeof import('express');
  app.use(express.json({
    limit: bodyLimit,
    // Terima juga content-type CSP report supaya /csp-report bisa parse body.
    type: ['application/json', 'application/csp-report', 'application/reports+json'],
  }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  app.use(compression());
  app.use(cookieParser());

  // --- Request-ID untuk traceability audit/log ---
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rid = (req.headers['x-request-id'] as string) || randomUUID();
    (req as Request & { id: string }).id = rid;
    res.setHeader('X-Request-Id', rid);
    next();
  });

  // --- CORS strict ---
  // Di production: WAJIB whitelist eksplisit. `*` ditolak.
  if (isProd && (corsOrigins.length === 0 || corsOrigins.includes('*'))) {
    throw new Error(
      'CORS_ORIGINS wajib berisi origin eksplisit (tanpa "*") pada NODE_ENV=production',
    );
  }
  app.enableCors({
    origin: corsOrigins.length === 0 || corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    maxAge: 600,
  });

  // --- Prefix & versioning REST API: /api/v1/... ---
  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: apiVersion });

  // --- Validasi DTO otomatis untuk semua request ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Sembunyikan detail internal di produksi
      disableErrorMessages: isProd && (config.get<string>('EXPOSE_VALIDATION_ERROR') ?? 'false') !== 'true',
    }),
  );

  // --- Global filter & interceptor untuk format response standar ---
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // --- Swagger: hanya aktif di non-produksi (kecuali dipaksa via env) ---
  const swaggerEnabled =
    (config.get<string>('SWAGGER_ENABLED') ?? (isProd ? 'false' : 'true')) === 'true';
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

  // --- Graceful shutdown (SIGTERM/SIGINT) ---
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}/${globalPrefix}/v${apiVersion}`);
}

void bootstrap();
