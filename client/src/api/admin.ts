import { apiRequest } from './client';
import {
  DashboardData,
  DepartmentScrutinyDateGroup,
  FilterParams,
  SyncStatus,
} from '../types/admin';

export async function loginAdmin(code: string): Promise<{ success: boolean; token?: string; user?: any; message?: string }> {
  return apiRequest('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function fetchAdminDashboard(filter: FilterParams): Promise<{ success: boolean; data: DashboardData }> {
  const query = new URLSearchParams();
  query.set('type', filter.type);
  if (filter.start) query.set('start', filter.start);
  if (filter.end) query.set('end', filter.end);

  return apiRequest(`/admin/dashboard?${query.toString()}`);
}

export async function fetchDepartmentScrutiny(
  deptName: string,
  filter: FilterParams
): Promise<{ success: boolean; data: DepartmentScrutinyDateGroup[] }> {
  const query = new URLSearchParams();
  query.set('type', filter.type);
  if (filter.start) query.set('start', filter.start);
  if (filter.end) query.set('end', filter.end);

  return apiRequest(`/admin/departments/${encodeURIComponent(deptName)}/scrutiny?${query.toString()}`);
}

export async function saveSuperAdminRating(
  deptName: string,
  headId: string | null,
  dateStr: string,
  adminRating: number
): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/admin/departments/${encodeURIComponent(deptName)}/head-rating`, {
    method: 'PUT',
    body: JSON.stringify({
      headId,
      dateStr,
      adminRating,
    }),
  });
}

export async function fetchSyncStatus(): Promise<{ success: boolean; data: SyncStatus }> {
  return apiRequest('/sync/status');
}

export async function triggerManualSync(): Promise<{ success: boolean; data: any }> {
  return apiRequest('/sync/trigger', {
    method: 'POST',
  });
}

export async function triggerInboundSync(): Promise<{ success: boolean; data: any }> {
  return apiRequest('/sync/inbound', {
    method: 'POST',
  });
}

// ─── SUBMISSION TRACKER API ────────────────────────────────────
export async function fetchSubmissionTracker(
  start: string,
  end: string,
  dept = 'All'
): Promise<{ success: boolean; data: any }> {
  const query = new URLSearchParams({ start, end, dept });
  return apiRequest(`/tracker/submissions?${query.toString()}`);
}

export async function fetchSubmissionDetail(
  date: string,
  empId: string
): Promise<{ success: boolean; data: any }> {
  const query = new URLSearchParams({ date, empId });
  return apiRequest(`/tracker/submission-detail?${query.toString()}`);
}

// ─── TASK MANAGEMENT API ──────────────────────────────────────
export async function fetchTaskDashboard(): Promise<{ success: boolean; data: any }> {
  return apiRequest('/tasks/dashboard');
}

export async function fetchTaskDetail(taskId: string): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/tasks/${encodeURIComponent(taskId)}`);
}

export async function createTask(payload: any): Promise<{ success: boolean; data: any }> {
  return apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  rating?: number,
  ratingRemark?: string,
  remark?: string,
  by = 'Branch Head'
): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/tasks/${encodeURIComponent(taskId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, rating, ratingRemark, remark, by }),
  });
}

export async function toggleChecklistItem(
  itemId: string,
  done: boolean,
  by = 'Branch Head'
): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/tasks/checklist/${encodeURIComponent(itemId)}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ done, by }),
  });
}

export async function addChecklistItem(
  taskId: string,
  subTaskId: string,
  itemText: string
): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/tasks/${encodeURIComponent(taskId)}/checklist`, {
    method: 'POST',
    body: JSON.stringify({ subTaskId, itemText }),
  });
}

export async function addTaskRemark(
  taskId: string,
  remark: string,
  by = 'Branch Head'
): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/tasks/${encodeURIComponent(taskId)}/remarks`, {
    method: 'POST',
    body: JSON.stringify({ remark, by }),
  });
}

export async function updateTask(
  taskId: string,
  payload: any
): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; data: any }> {
  return apiRequest(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}



