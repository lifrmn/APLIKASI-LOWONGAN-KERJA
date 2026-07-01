/**
 * File: backend/src/modules/ai/providers/ai-provider.interface.ts
 * Fungsi:
 *  - Abstraksi provider AI agar controller/service tidak terikat
 *    ke implementasi tertentu (rule-based, eksternal, dsb).
 *  - Implementasi pertama: RuleBasedAiProvider.
 *  - Tahap 4 (opsional) bisa menambah ExternalAiProvider tanpa
 *    mengubah controller.
 */

import { CvScoreCategory } from '@prisma/client';

/** Hasil CV scoring per pencari kerja. */
export interface CvScoreResult {
  jobSeekerId: string;
  score: number; // 0..100
  category: CvScoreCategory;
  breakdown: Array<{ key: string; score: number; max: number }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

/** Hasil 1 rekomendasi lowongan. */
export interface JobMatchResult {
  jobId: string;
  matchScore: number; // 0..100
  reasons: string[];
  components: {
    skill: number;
    education: number;
    location: number;
    experience: number;
  };
}

/** Hasil parsing CV teks. */
export interface ResumeParseResult {
  emails: string[];
  phones: string[];
  skills: string[]; // nama skill yang terdeteksi dari master skills
  educationKeywords: string[]; // mis. "S1", "SMA", "D3"
  experienceYears: number | null; // total tahun pengalaman (estimasi)
  rawTextLength: number;
}

export interface SkillRecommendationItem {
  skillId: string;
  name: string;
  category: string | null;
  frequency: number; // jumlah lowongan aktif yang membutuhkan skill ini
}

export interface AiProvider {
  scoreCv(jobSeekerId: string): Promise<CvScoreResult>;
  matchJobs(jobSeekerId: string, limit?: number): Promise<JobMatchResult[]>;
  parseResume(text: string): Promise<ResumeParseResult>;
  recommendSkills(jobSeekerId: string, limit?: number): Promise<SkillRecommendationItem[]>;
}

/** Injection token DI Nest. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');
