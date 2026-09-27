import { prisma } from '../prisma/client';

export interface AuditLogParams {
  actor?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
}

export class AuditService {
  public static async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actor: params.actor || 'SUPER_ADMIN',
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          metadata: params.metadata || null,
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (error) {
      console.error('⚠️ Failed to write audit log:', error);
    }
  }
}
