import { prisma } from '../prisma/client';
import { getTimeFromDDMMYYYY } from '../utils/dateUtils';
import {
  calculateEmployeeDailyFinalScore,
  calculateDateBaseAverage,
  calculateSuperAdminFinalScore,
} from '../utils/scoreEngine';
import { AuditService } from './auditService';

export interface SaveRatingResult {
  success: boolean;
  message?: string;
  data?: {
    date: string;
    department: string;
    headId: string | null;
    baseAvg: number;
    adminRating: number;
    finalHeadScore: number;
  };
}

export class RatingService {
  public static async saveSuperAdminRating(
    deptName: string,
    headId: string | null,
    dateStr: string,
    adminRatingVal: number | string,
    actor: string = 'SUPER_ADMIN'
  ): Promise<SaveRatingResult> {
    const adminRating = typeof adminRatingVal === 'string' ? parseFloat(adminRatingVal) : adminRatingVal;

    if (isNaN(adminRating) || adminRating < 0 || adminRating > 200) {
      return { success: false, message: 'Valid rating range is 0% to 200%.' };
    }

    const dateTimestamp = getTimeFromDDMMYYYY(dateStr);

    // 1. Calculate Base Average for this department on this date
    const dailyReports = await prisma.dailyReport.findMany({
      where: {
        OR: [
          { departmentName: deptName, reportDate: dateStr },
          { department: deptName, date: dateStr },
          { departmentName: deptName, date: dateStr },
          { department: deptName, reportDate: dateStr },
        ],
      },
    });

    const validScores: number[] = [];
    for (const r of dailyReports) {
      const eodRaw = r.eodData || (r as any).eod_data;
      const hasEOD =
        eodRaw &&
        (typeof eodRaw === 'string'
          ? eodRaw.trim() !== '' && eodRaw !== '{}'
          : Object.keys(eodRaw as object).length > 0);

      if (hasEOD) {
        const sysScore = r.systemScore ?? r.system_score;
        const headRating = r.headRating || r.head_rating;
        const finalScoreVal = r.finalScore ?? r.final_score;
        const lastUpdated = r.lastUpdated || r.last_updated;
        const approvalStatus = r.approval_status;

        const { finalScore } = calculateEmployeeDailyFinalScore(
          sysScore,
          headRating,
          finalScoreVal,
          lastUpdated,
          approvalStatus
        );
        validScores.push(finalScore);
      }
    }

    const baseAvg = calculateDateBaseAverage(validScores);
    const finalHeadScore = calculateSuperAdminFinalScore(baseAvg, adminRating);

    // 2. Atomic Transaction: Upsert HeadRating + Enqueue Outbox SyncJob
    const ratingRecord = await prisma.$transaction(async (tx) => {
      // Upsert HeadRating
      const hr = await tx.headRating.upsert({
        where: {
          departmentName_ratingDate: {
            departmentName: deptName,
            ratingDate: dateStr,
          },
        },
        create: {
          ratingDate: dateStr,
          dateTimestamp: BigInt(dateTimestamp),
          departmentName: deptName,
          headId: headId || null,
          baseScore: baseAvg,
          adminRating,
          finalHeadScore,
        },
        update: {
          headId: headId || null,
          baseScore: baseAvg,
          adminRating,
          finalHeadScore,
          updatedAt: new Date(),
        },
      });

      // Enqueue Outbox Sync Job for Google Sheets
      await tx.syncJob.create({
        data: {
          entityType: 'HEAD_RATING',
          entityId: `${dateStr}_${deptName}`,
          operation: 'UPSERT',
          status: 'PENDING',
          payload: {
            date: dateStr,
            department: deptName,
            headId: headId || '',
            baseScore: `${baseAvg}%`,
            adminRating: `${adminRating}`,
            finalHeadScore: `${finalHeadScore}%`,
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return hr;
    });

    // 3. Audit Log
    await AuditService.log({
      actor,
      action: 'SAVE_SUPER_ADMIN_RATING',
      entity: 'HeadRating',
      entityId: ratingRecord.id,
      metadata: {
        department: deptName,
        headId,
        date: dateStr,
        baseAvg,
        adminRating,
        finalHeadScore,
      },
    });

    return {
      success: true,
      data: {
        date: dateStr,
        department: deptName,
        headId,
        baseAvg,
        adminRating,
        finalHeadScore,
      },
    };
  }
}
