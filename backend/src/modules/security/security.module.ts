/**
 * File: backend/src/modules/security/security.module.ts
 */
import { Module } from '@nestjs/common';
import { CspReportController } from './csp-report.controller';

@Module({ controllers: [CspReportController] })
export class SecurityModule {}
