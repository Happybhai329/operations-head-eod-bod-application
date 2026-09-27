import { Request, Response, NextFunction } from 'express';
import { ScrutinyService } from '../services/scrutinyService';
import { DateFilter } from '../utils/dateUtils';

export class ScrutinyController {
  public static async getDepartmentScrutiny(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentName = decodeURIComponent(req.params.departmentName);
      const type = (req.query.type as string) || 'Weekly';
      const start = req.query.start as string | undefined;
      const end = req.query.end as string | undefined;

      const filter: DateFilter = {
        type: (['Daily', 'Weekly', 'Monthly', 'Custom'].includes(type) ? type : 'Weekly') as any,
        start,
        end,
      };

      const data = await ScrutinyService.getDepartmentScrutiny(departmentName, filter);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
