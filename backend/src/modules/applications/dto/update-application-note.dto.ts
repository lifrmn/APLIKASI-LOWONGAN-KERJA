/**
 * File: backend/src/modules/applications/dto/update-application-note.dto.ts
 * Fungsi: Validasi payload PATCH /applications/:id/note.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateApplicationNoteDto {
  @ApiProperty({ example: 'Pelamar punya pengalaman relevan, lanjut interview.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note!: string;
}
