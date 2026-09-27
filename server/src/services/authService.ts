import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { AuditService } from './auditService';

export interface AdminAuthResult {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    username: string;
    role: string;
  };
}

export class AuthService {
  /**
   * Validates Super Admin security code / password and returns a signed JWT.
   */
  public static async loginAdmin(code: string, ipAddress?: string): Promise<AdminAuthResult> {
    if (!code || typeof code !== 'string') {
      return { success: false, message: 'Security code is required.' };
    }

    const trimmedCode = code.trim();

    // 1. Fast path: Direct environment code match
    const isDirectMatch = trimmedCode === env.SUPER_ADMIN_CODE;
    if (isDirectMatch) {
      // Async audit log without blocking response
      AuditService.log({
        actor: env.SUPER_ADMIN_USERNAME,
        action: 'ADMIN_LOGIN_SUCCESS',
        entity: 'AdminAuth',
        ipAddress,
        metadata: { role: 'SUPER_ADMIN', mode: 'DIRECT_CODE' },
      }).catch(() => {});

      const token = jwt.sign(
        {
          username: env.SUPER_ADMIN_USERNAME,
          role: 'SUPER_ADMIN',
        },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        success: true,
        token,
        user: {
          username: env.SUPER_ADMIN_USERNAME,
          role: 'SUPER_ADMIN',
        },
      };
    }

    // 2. Database admin user check
    let isDbMatch = false;
    try {
      const adminUser = await prisma.adminUser.findUnique({
        where: { username: env.SUPER_ADMIN_USERNAME },
      });

      if (adminUser) {
        isDbMatch = await bcrypt.compare(trimmedCode, adminUser.passwordHash);
      }
    } catch (dbError) {
      // DB offline
    }

    if (!isDbMatch) {
      AuditService.log({
        actor: 'ANONYMOUS',
        action: 'FAILED_LOGIN_ATTEMPT',
        entity: 'AdminAuth',
        ipAddress,
        metadata: { timestamp: new Date().toISOString() },
      }).catch(() => {});

      return { success: false, message: 'Invalid Security Code!' };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        username: env.SUPER_ADMIN_USERNAME,
        role: 'SUPER_ADMIN',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await AuditService.log({
      actor: env.SUPER_ADMIN_USERNAME,
      action: 'ADMIN_LOGIN_SUCCESS',
      entity: 'AdminAuth',
      ipAddress,
      metadata: { role: 'SUPER_ADMIN' },
    });

    return {
      success: true,
      token,
      user: {
        username: env.SUPER_ADMIN_USERNAME,
        role: 'SUPER_ADMIN',
      },
    };
  }
}
