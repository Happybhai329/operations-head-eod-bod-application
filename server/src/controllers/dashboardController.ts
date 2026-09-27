import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService';
import { DateFilter } from '../utils/dateUtils';

export class DashboardController {
  public static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = (req.query.type as string) || 'Weekly';
      const start = req.query.start as string | undefined;
      const end = req.query.end as string | undefined;

      const filter: DateFilter = {
        type: (['Daily', 'Weekly', 'Monthly', 'Custom'].includes(type) ? type : 'Weekly') as any,
        start,
        end,
      };

      const data = await DashboardService.getAdminDashboard(filter);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
