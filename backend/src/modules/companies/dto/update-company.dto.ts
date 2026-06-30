/**
 * File: backend/src/modules/companies/dto/update-company.dto.ts
 * Fungsi: Validasi payload PATCH /companies/:id.
 *         userId tidak boleh diubah lewat endpoint ini.
 */

import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(OmitType(CreateCompanyDto, ['userId'] as const)) {}
