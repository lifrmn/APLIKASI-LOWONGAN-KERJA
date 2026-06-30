/**
 * File: backend/src/modules/dashboard/dashboard.controller.ts
 * Fungsi:
 *  - Endpoint REST dashboard. Setiap endpoint hanya boleh diakses
 *    role tertentu (via @Roles).
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { success } from '../../common/utils/api-response.util';
import { DashboardService } from './dashboard.service';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  // -------- ROLE-SPECIFIC DASHBOARDS --------

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA')
  @ApiOperation({ summary: 'Ringkasan utama (admin/leader/operator)' })
  async summary(@Query() query: DashboardFilterDto) {
    const data = await this.service.summary(query);
    return success(data, 'Ringkasan dashboard berhasil diambil');
  }

  @Get('admin')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Dashboard lengkap untuk admin' })
  async admin(@Query() query: DashboardFilterDto) {
    const data = await this.service.adminDashboard(query);
    return success(data, 'Dashboard admin berhasil diambil');
  }

  @Get('company')
  @Roles('COMPANY', 'HRD')
  @ApiOperation({ summary: 'Dashboard perusahaan (data milik perusahaan login)' })
  async company(@Query() query: DashboardFilterDto, @CurrentUser() actor: AuthUser) {
    const data = await this.service.companyDashboard(actor, query);
    return success(data, 'Dashboard perusahaan berhasil diambil');
  }

  @Get('job-seeker')
  @Roles('JOB_SEEKER')
  @ApiOperation({ summary: 'Dashboard pencari kerja (data milik user login)' })
  async jobSeeker(@Query() query: DashboardFilterDto, @CurrentUser() actor: AuthUser) {
    const data = await this.service.jobSeekerDashboard(actor, query);
    return success(data, 'Dashboard pencari kerja berhasil diambil');
  }

  @Get('leader')
  @Roles('LEADER', 'SUPER_ADMIN', 'ADMIN_DINAS')
  @ApiOperation({ summary: 'Dashboard untuk pimpinan / Bupati' })
  async leader(@Query() query: DashboardFilterDto) {
    const data = await this.service.leaderDashboard(query);
    return success(data, 'Dashboard pimpinan berhasil diambil');
  }

  // -------- BREAKDOWN ENDPOINTS (admin/leader/operator) --------

  @Get('users')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Statistik user per role' })
  async users(@Query() query: DashboardFilterDto) {
    const data = await this.service.usersByRole(query);
    return success(data, 'Statistik user berhasil diambil');
  }

  @Get('job-seekers')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA')
  @ApiOperation({ summary: 'Statistik pencari kerja per pendidikan' })
  async jobSeekers(@Query() query: DashboardFilterDto) {
    const data = await this.service.jobSeekersByEducation(query);
    return success(data, 'Statistik pencari kerja berhasil diambil');
  }

  @Get('companies')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Statistik perusahaan per status verifikasi' })
  async companies(@Query() query: DashboardFilterDto) {
    const data = await this.service.companiesByVerification(query);
    return success(data, 'Statistik perusahaan berhasil diambil');
  }

  @Get('jobs')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Statistik lowongan per kategori & status' })
  async jobs(@Query() query: DashboardFilterDto) {
    const [byCategory, byStatus] = await Promise.all([
      this.service.jobsByCategory(query),
      this.service.jobsByStatus(query),
    ]);
    return success({ byCategory, byStatus }, 'Statistik lowongan berhasil diambil');
  }

  @Get('applications')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Statistik lamaran per status' })
  async applications(@Query() query: DashboardFilterDto) {
    const data = await this.service.applicationsByStatus(query);
    return success(data, 'Statistik lamaran berhasil diambil');
  }

  @Get('interviews')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Statistik interview per status' })
  async interviews() {
    const data = await this.service.interviewsByStatus();
    return success(data, 'Statistik interview berhasil diambil');
  }

  @Get('skills')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Top skill pencari kerja & lowongan' })
  async skills() {
    const data = await this.service.skillsStats(10);
    return success(data, 'Statistik skill berhasil diambil');
  }

  @Get('regions')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA')
  @ApiOperation({ summary: 'Statistik pencari kerja & perusahaan per kecamatan/desa' })
  async regions() {
    const data = await this.service.regionsStats();
    return success(data, 'Statistik regional berhasil diambil');
  }

  @Get('monthly-jobs')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Lowongan per bulan (default 12 bulan terakhir)' })
  async monthlyJobs(@Query() query: DashboardFilterDto) {
    const data = await this.service.monthlyJobs(query);
    return success(data, 'Statistik lowongan bulanan berhasil diambil');
  }

  @Get('monthly-applications')
  @Roles('SUPER_ADMIN', 'ADMIN_DINAS', 'LEADER')
  @ApiOperation({ summary: 'Lamaran per bulan (default 12 bulan terakhir)' })
  async monthlyApplications(@Query() query: DashboardFilterDto) {
    const data = await this.service.monthlyApplications(query);
    return success(data, 'Statistik lamaran bulanan berhasil diambil');
  }
}
