export type FilterType = 'Daily' | 'Weekly' | 'Monthly' | 'Custom';

export interface FilterParams {
  type: FilterType;
  start?: string;
  end?: string;
}

export interface DepartmentMetric {
  department: string;
  headName: string | null;
  headId: string | null;
  score: number;
  hasData: boolean;
}

export interface EmployeeLeaderboardItem {
  empId: string;
  name: string;
  dept: string;
  score: number;
}

export interface HeadLeaderboardItem {
  department: string;
  headName: string | null;
  headId: string | null;
  score: number;
  hasData: boolean;
}

export interface DashboardData {
  orgAverage: number;
  departments: DepartmentMetric[];
  topEmps: EmployeeLeaderboardItem[];
  bottomEmps: EmployeeLeaderboardItem[];
  topHeads: HeadLeaderboardItem[];
  bottomHeads: HeadLeaderboardItem[];
}

export interface ScrutinyEmployeeRecord {
  empId: string;
  empName: string;
  sysScore: number;
  headRating: string;
  finalScore: number;
  bodData: any;
  eodData: any;
}

export interface DepartmentScrutinyDateGroup {
  date: string;
  timeVal: number;
  baseAvg: number;
  adminRating: number | string;
  finalScore: number;
  records: ScrutinyEmployeeRecord[];
}

export interface SyncStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

// ─── SUBMISSION TRACKER TYPES ──────────────────────────────────
export interface TrackerRecord {
  date: string;
  dateTime: number;
  empId: string;
  empName: string;
  dept: string;
  bod: boolean;
  eod: boolean;
  status: 'Both' | 'BOD Only' | 'EOD Only (Missing BOD)' | 'Not Submitted';
  systemScore?: number | null;
  headRating?: string | null;
  finalScore?: number | null;
  approvalStatus?: 'Approved' | 'Auto Approved' | 'Pending Review' | 'Pending EOD' | 'EOD Missed' | 'Not Submitted' | string;
  headName?: string | null;
  lastUpdated?: string | null;
}

export interface TrackerSummary {
  totalRecords: number;
  uniqueEmployees: number;
  bodDone: number;
  bodPending: number;
  eodDone: number;
  eodPending: number;
  bothDone: number;
  bodOnly: number;
  eodOnly?: number;
  none: number;
  headRated?: number;
  autoApproved?: number;
  pendingReview?: number;
  eodMissed?: number;
  pendingEOD?: number;
}

export interface DateSummary {
  date: string;
  total: number;
  bodDone: number;
  bodPending: number;
  eodDone: number;
  eodPending: number;
  bothDone: number;
  bodOnly: number;
  eodOnly?: number;
  none: number;
}

export interface DeptSummary {
  dept: string;
  total: number;
  bodDone: number;
  bodPending: number;
  eodDone: number;
  eodPending: number;
  bothDone: number;
  bodOnly: number;
  eodOnly?: number;
  none: number;
}

export interface TrackerData {
  departments: string[];
  summary: TrackerSummary;
  dateSummary: DateSummary[];
  deptSummary: DeptSummary[];
  records: TrackerRecord[];
}

export interface SubmissionDetail {
  date: string;
  empId: string;
  empName: string;
  dept: string;
  headName?: string | null;
  bodContent: any;
  eodContent: any;
  systemScore: number;
  headRating: string | null;
  finalScore: number;
  updatedAt: string;
  approvalStatus?: string | null;
}

// ─── TASK MANAGEMENT TYPES ────────────────────────────────────
export interface ChecklistItem {
  itemId: string;
  text: string;
  done: boolean;
  doneAt: string;
  doneBy: string;
}

export interface SubTaskItem {
  sid: string;
  name: string;
  orderNo: number;
  status: string;
  progress: number;
  items: ChecklistItem[];
}

export interface TaskAttachmentItem {
  attachId: string;
  fileName: string;
  url: string;
  type: string;
}

export interface TaskRemarkItem {
  remarkId: string;
  text: string;
  by: string;
  at: string;
}

export interface TaskItem {
  taskId: string;
  taskName: string;
  instructions: string;
  assignToId: string;
  assignToName: string;
  department: string;
  assignedBy: string;
  priority: string;
  deadline: string | null;
  status: string;
  progress: number;
  createdAt: string;
  completedAt: string;
  rating: number | null;
  ratingRemark: string | null;
  mode: string;
  overDue: boolean;
  completedLate: boolean;
  derivedStatus: string;
}

export interface TaskDetailData extends TaskItem {
  subTasks: SubTaskItem[];
  attachments: TaskAttachmentItem[];
  remarks: TaskRemarkItem[];
}

export interface TaskSummary {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  lateCompleted: number;
  onTime: number;
}

export interface AssigneeTaskSummary {
  name: string;
  dept: string;
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  overdue: number;
  late: number;
  onTime: number;
}

export interface DeptTaskSummary {
  dept: string;
  total: number;
  completed: number;
  overdue: number;
  active: number;
}

export interface TaskDashboardData {
  employees: Array<{ id: string; name: string; dept: string }>;
  tasks: TaskItem[];
  summary: TaskSummary;
  assigneeSummary: AssigneeTaskSummary[];
  deptSummary: DeptTaskSummary[];
}

