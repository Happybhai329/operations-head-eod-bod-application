import { Request, Response, NextFunction } from 'express';
import { RatingService } from '../services/ratingService';
import { AuthRequest } from '../middleware/authMiddleware';

export class RatingController {
  public static async saveSuperAdminRating(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentName = decodeURIComponent(req.params.departmentName);
      const { headId, dateStr, adminRating } = req.body;
      const actor = req.user?.username || 'SUPER_ADMIN';

      if (!dateStr || adminRating === undefined || adminRating === null) {
        res.status(400).json({
          success: false,
          message: 'Both dateStr and adminRating are required.',
        });
        return;
      }

      const result = await RatingService.saveSuperAdminRating(
        departmentName,
        headId,
        dateStr,
        adminRating,
        actor
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
