import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/taskService';

export class TaskController {
  public static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await TaskService.fetchTaskDashboard();
      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getTaskDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const data = await TaskService.fetchTaskDetail(taskId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TaskService.saveTask(req.body);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const { status, rating, ratingRemark, remark, by } = req.body;
      const result = await TaskService.updateTaskStatus({
        taskId,
        status,
        rating,
        ratingRemark,
        remark,
        by,
      });
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async toggleChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const { done, by } = req.body;
      const result = await TaskService.toggleChecklistItem(itemId, !!done, by);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async addChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const { subTaskId, itemText } = req.body;
      const result = await TaskService.addChecklistItem(taskId, subTaskId, itemText);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async addRemark(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const { remark, by } = req.body;
      const result = await TaskService.addTaskRemark(taskId, remark, by);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async editTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const result = await TaskService.editTask(taskId, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = req.params;
      const result = await TaskService.deleteTask(taskId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
