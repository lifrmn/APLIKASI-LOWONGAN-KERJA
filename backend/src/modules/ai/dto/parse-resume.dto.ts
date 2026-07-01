/**
 * File: backend/src/modules/ai/dto/parse-resume.dto.ts
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ParseResumeDto {
  @ApiProperty({
    description: 'Teks mentah CV yang akan diparse (hasil ekstraksi PDF/DOCX di klien).',
    minLength: 10,
    maxLength: 200000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(200000)
  text!: string;
}
