import { Request, Response, NextFunction } from 'express';
import { TrackerService } from '../services/trackerService';

export class TrackerController {
  public static async getSubmissionTracker(req: Request, res: Response, next: NextFunction) {
    try {
      const { start, end, dept } = req.query;
      if (!start || !end) {
        return res.status(400).json({ success: false, message: 'Start and end dates are required.' });
      }

      const data = await TrackerService.fetchSubmissionTracker({
        start: String(start),
        end: String(end),
        dept: dept ? String(dept) : 'All',
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      next(err);
    }
  }

  public static async getSubmissionDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { date, empId } = req.query;
      if (!date || !empId) {
        return res.status(400).json({ success: false, message: 'Date and Employee ID are required.' });
      }

      const data = await TrackerService.fetchSubmissionDetail(String(date), String(empId));

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      next(err);
    }
  }

  public static async getEmployeeList(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await TrackerService.fetchActiveEmployeesList();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      next(err);
    }
  }

  public static async getEmployeeReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { empId, start, end } = req.query;
      if (!empId || !start || !end) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID (empId), start date (start), and end date (end) are required.',
        });
      }

      const data = await TrackerService.fetchEmployeeBodEodReport(
        String(empId),
        String(start),
        String(end)
      );

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err: any) {
      next(err);
    }
  }
}
