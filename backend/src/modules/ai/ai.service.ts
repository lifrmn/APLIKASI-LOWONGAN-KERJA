/**
 * File: backend/src/modules/ai/ai.service.ts
 * Fungsi:
 *  - Facade modul AI. Memetakan kebutuhan controller ke provider
 *    (rule-based di MVP). Menangani:
 *      * resolusi jobSeekerId dari user yang sedang login,
 *      * ownership check (JOB_SEEKER hanya boleh akses profil sendiri),
 *      * audit log untuk setiap aksi mutatif AI.
 */

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../../common/services/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { RequestContext } from '../auth/auth.service';
import {
  AI_PROVIDER,
  AiProvider,
  CvScoreResult,
  JobMatchResult,
  ResumeParseResult,
  SkillRecommendationItem,
} from './providers/ai-provider.interface';

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN_DINAS',
  'OPERATOR_KECAMATAN',
  'OPERATOR_DESA',
]);

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  // ---------- CV scoring ----------
  async scoreMyCv(actor: AuthUser, ctx: RequestContext): Promise<CvScoreResult> {
    const jobSeekerId = await this.resolveOwnJobSeekerId(actor);
    const res = await this.provider.scoreCv(jobSeekerId);
    await this.audit.write({
      userId: actor.id,
      action: 'AI_CV_SCORE',
      module: 'AI',
      description: `CV score = ${res.score} (${res.category})`,
      entity: 'JobSeeker',
      entityId: jobSeekerId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { score: res.score, category: res.category },
    });
    return res;
  }

  async scoreCvByJobSeeker(
    actor: AuthUser,
    jobSeekerId: string,
    ctx: RequestContext,
  ): Promise<CvScoreResult> {
    await this.ensureCanReadJobSeeker(actor, jobSeekerId);
    const res = await this.provider.scoreCv(jobSeekerId);
    await this.audit.write({
      userId: actor.id,
      action: 'AI_CV_SCORE',
      module: 'AI',
      description: `Admin/HRD melihat CV score (${res.category})`,
      entity: 'JobSeeker',
      entityId: jobSeekerId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { score: res.score, category: res.category, viewerRole: actor.role },
    });
    return res;
  }

  async getLatestCvScore(actor: AuthUser, jobSeekerId?: string) {
    const targetId = jobSeekerId ?? (await this.resolveOwnJobSeekerId(actor));
    if (jobSeekerId) await this.ensureCanReadJobSeeker(actor, jobSeekerId);
    return this.prisma.aiCvScore.findFirst({
      where: { jobSeekerId: targetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- Job matching ----------
  async matchMyJobs(
    actor: AuthUser,
    limit: number | undefined,
    ctx: RequestContext,
  ): Promise<JobMatchResult[]> {
    const jobSeekerId = await this.resolveOwnJobSeekerId(actor);
    const res = await this.provider.matchJobs(jobSeekerId, limit);
    await this.audit.write({
      userId: actor.id,
      action: 'AI_JOB_MATCHING',
      module: 'AI',
      description: `Hitung ulang rekomendasi lowongan (${res.length} hasil)`,
      entity: 'JobSeeker',
      entityId: jobSeekerId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return res;
  }

  async listCachedRecommendations(actor: AuthUser, limit: number, jobSeekerId?: string) {
    const targetId = jobSeekerId ?? (await this.resolveOwnJobSeekerId(actor));
    if (jobSeekerId) await this.ensureCanReadJobSeeker(actor, jobSeekerId);
    return this.prisma.aiJobRecommendation.findMany({
      where: { jobSeekerId: targetId },
      orderBy: [{ matchScore: 'desc' }, { updatedAt: 'desc' }],
      take: Math.max(1, Math.min(100, limit ?? 20)),
      include: {
        // include job via relation tidak dipasang di schema; expose jobId saja.
      } as never,
    }).then((rows) =>
      rows.map((r) => ({
        jobId: r.jobId,
        matchScore: r.matchScore,
        reasons: (r.reasons as string[] | null) ?? [],
        updatedAt: r.updatedAt,
      })),
    );
  }

  // ---------- Resume parsing ----------
  async parseResume(
    actor: AuthUser,
    text: string,
    ctx: RequestContext,
  ): Promise<ResumeParseResult> {
    const res = await this.provider.parseResume(text);

    // simpan jika user punya profil pencari kerja (best-effort)
    let jobSeekerId: string | null = null;
    if (actor.role === 'JOB_SEEKER') {
      const seeker = await this.prisma.jobSeeker.findFirst({
        where: { userId: actor.id, deletedAt: null },
        select: { id: true },
      });
      jobSeekerId = seeker?.id ?? null;
    }
    await this.prisma.resumeParse.create({
      data: {
        jobSeekerId,
        rawText: text.slice(0, 200_000),
        parsedData: res as unknown as object,
      },
    });

    await this.audit.write({
      userId: actor.id,
      action: 'AI_RESUME_PARSE',
      module: 'AI',
      description: `Resume parsed (len=${res.rawTextLength}, skills=${res.skills.length})`,
      entity: jobSeekerId ? 'JobSeeker' : null,
      entityId: jobSeekerId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return res;
  }

  // ---------- Skill recommendation ----------
  async recommendSkillsForMe(actor: AuthUser, limit?: number): Promise<SkillRecommendationItem[]> {
    const jobSeekerId = await this.resolveOwnJobSeekerId(actor);
    return this.provider.recommendSkills(jobSeekerId, limit);
  }

  // ============================================================
  //                          INTERNAL
  // ============================================================
  private async resolveOwnJobSeekerId(actor: AuthUser): Promise<string> {
    if (actor.role !== 'JOB_SEEKER') {
      throw new ForbiddenException('Hanya pencari kerja yang dapat mengakses fitur ini');
    }
    const seeker = await this.prisma.jobSeeker.findFirst({
      where: { userId: actor.id, deletedAt: null },
      select: { id: true },
    });
    if (!seeker) throw new NotFoundException('Profil pencari kerja belum dibuat');
    return seeker.id;
  }

  private async ensureCanReadJobSeeker(actor: AuthUser, jobSeekerId: string): Promise<void> {
    if (ADMIN_ROLES.has(actor.role)) return;
    // JOB_SEEKER hanya boleh akses miliknya sendiri
    const seeker = await this.prisma.jobSeeker.findFirst({
      where: { id: jobSeekerId, deletedAt: null },
      select: { userId: true },
    });
    if (!seeker) throw new NotFoundException('Pencari kerja tidak ditemukan');
    if (seeker.userId !== actor.id) {
      throw new ForbiddenException('Tidak berhak mengakses data pencari kerja ini');
    }
  }
}
