import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { DashboardController } from '../controllers/dashboardController';
import { ScrutinyController } from '../controllers/scrutinyController';
import { RatingController } from '../controllers/ratingController';
import { SyncController } from '../controllers/syncController';
import { TrackerController } from '../controllers/trackerController';
import { TaskController } from '../controllers/taskController';
import { requireAdminAuth } from '../middleware/authMiddleware';
import { authRateLimiter, apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply global rate limiter
router.use(apiRateLimiter);

// ------------------------------------------
// HEALTH CHECK ROUTE
// ------------------------------------------
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TPC Branch Head & Super Admin API',
  });
});

// ------------------------------------------
// AUTHENTICATION ROUTES
// ------------------------------------------
router.post('/auth/admin/login', authRateLimiter, AuthController.login);
router.get('/auth/me', requireAdminAuth, AuthController.me);
router.post('/auth/logout', AuthController.logout);

// ------------------------------------------
// SUPER ADMIN & BRANCH HEAD DASHBOARD ROUTES
// ------------------------------------------
router.get('/admin/dashboard', DashboardController.getDashboard);
router.get('/admin/departments/:departmentName/scrutiny', ScrutinyController.getDepartmentScrutiny);
router.put('/admin/departments/:departmentName/head-rating', requireAdminAuth, RatingController.saveSuperAdminRating);

// ------------------------------------------
// BOD/EOD SUBMISSION TRACKER ROUTES
// ------------------------------------------
router.get('/tracker/submissions', TrackerController.getSubmissionTracker);
router.get('/tracker/submission-detail', TrackerController.getSubmissionDetail);

// ------------------------------------------
// TASK MANAGEMENT ROUTES
// ------------------------------------------
router.get('/tasks/dashboard', TaskController.getDashboard);
router.get('/tasks/:taskId', TaskController.getTaskDetail);
router.post('/tasks', TaskController.createTask);
router.put('/tasks/:taskId', TaskController.editTask);
router.delete('/tasks/:taskId', TaskController.deleteTask);
router.put('/tasks/:taskId/status', TaskController.updateStatus);
router.put('/tasks/checklist/:itemId/toggle', TaskController.toggleChecklistItem);
router.post('/tasks/:taskId/checklist', TaskController.addChecklistItem);
router.post('/tasks/:taskId/remarks', TaskController.addRemark);

// ------------------------------------------
// GOOGLE SHEETS SYNC ROUTES
// ------------------------------------------
router.get('/sync/status', SyncController.getStatus);
router.post('/sync/trigger', requireAdminAuth, SyncController.triggerSync);
router.post('/sync/inbound', SyncController.triggerInboundSync);

export default router;
