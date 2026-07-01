/**
 * File: backend/src/modules/ai/ai.controller.ts
 * Fungsi:
 *  - Endpoint REST untuk fitur AI rule-based:
 *      * CV scoring
 *      * Job matching / rekomendasi lowongan
 *      * Resume parsing
 *      * Skill recommendation
 *  - Semua endpoint butuh login (JwtAuthGuard global).
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { success } from '../../common/utils/api-response.util';
import { RequestContext } from '../auth/auth.service';
import { AiService } from './ai.service';
import { ParseResumeDto } from './dto/parse-resume.dto';
import {
  RecommendJobsQueryDto,
  RecommendSkillsQueryDto,
} from './dto/recommend-jobs.query.dto';

@ApiTags('AI')
@ApiBearerAuth('access-token')
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(private readonly service: AiService) {}

  private ctxOf(req: Request): RequestContext {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // ---------- CV SCORING ----------

  @Get('cv-score/me')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Ambil skor CV terakhir milik saya' })
  async getMyLatestScore(@CurrentUser() actor: AuthUser) {
    const data = await this.service.getLatestCvScore(actor);
    return success(data, 'Skor CV terakhir berhasil diambil');
  }

  @Post('cv-score/me/recompute')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Hitung ulang skor CV (menyimpan history)' })
  async recomputeMyScore(@CurrentUser() actor: AuthUser, @Req() req: Request) {
    const data = await this.service.scoreMyCv(actor, this.ctxOf(req));
    return success(data, 'Skor CV berhasil dihitung ulang');
  }

  @Get('cv-score/:jobSeekerId')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA')
  @ApiOperation({ summary: 'Skor CV pencari kerja tertentu (admin)' })
  async getScoreByAdmin(
    @CurrentUser() actor: AuthUser,
    @Param('jobSeekerId', new ParseUUIDPipe()) jobSeekerId: string,
    @Req() req: Request,
  ) {
    const data = await this.service.scoreCvByJobSeeker(actor, jobSeekerId, this.ctxOf(req));
    return success(data, 'Skor CV berhasil dihitung');
  }

  // ---------- JOB MATCHING ----------

  @Get('job-recommendations/me')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Daftar rekomendasi lowongan (cache terakhir)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async myRecommendations(
    @CurrentUser() actor: AuthUser,
    @Query() query: RecommendJobsQueryDto,
  ) {
    const data = await this.service.listCachedRecommendations(actor, query.limit ?? 20);
    return success(data, 'Rekomendasi lowongan berhasil diambil');
  }

  @Post('job-recommendations/me/recompute')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Hitung ulang rekomendasi lowongan' })
  async recomputeMyRecommendations(
    @CurrentUser() actor: AuthUser,
    @Query() query: RecommendJobsQueryDto,
    @Req() req: Request,
  ) {
    const data = await this.service.matchMyJobs(actor, query.limit, this.ctxOf(req));
    return success(data, 'Rekomendasi lowongan berhasil dihitung ulang');
  }

  @Get('job-recommendations/:jobSeekerId')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Rekomendasi lowongan untuk pencari kerja tertentu (admin)' })
  async recommendationsByAdmin(
    @CurrentUser() actor: AuthUser,
    @Param('jobSeekerId', new ParseUUIDPipe()) jobSeekerId: string,
    @Query() query: RecommendJobsQueryDto,
  ) {
    const data = await this.service.listCachedRecommendations(actor, query.limit ?? 20, jobSeekerId);
    return success(data, 'Rekomendasi lowongan berhasil diambil');
  }

  // ---------- RESUME PARSER ----------

  @Post('resume-parse')
  @Roles('JOB_SEEKER', 'SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Parse teks CV (regex/keyword based)' })
  async parseResume(
    @CurrentUser() actor: AuthUser,
    @Body() dto: ParseResumeDto,
    @Req() req: Request,
  ) {
    const data = await this.service.parseResume(actor, dto.text, this.ctxOf(req));
    return success(data, 'Resume berhasil diparse');
  }

  // ---------- SKILL RECOMMENDATION ----------

  @Get('skill-recommendations/me')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Rekomendasi skill berdasarkan kebutuhan lowongan aktif' })
  async skillRecommendations(
    @CurrentUser() actor: AuthUser,
    @Query() query: RecommendSkillsQueryDto,
  ) {
    const data = await this.service.recommendSkillsForMe(actor, query.limit);
    return success(data, 'Rekomendasi skill berhasil diambil');
  }
}
