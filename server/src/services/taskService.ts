import { prisma } from '../prisma/client';
import { GoogleSheetsClient } from '../sheets/sheetsClient';
import { env } from '../config/env';

export interface CreateTaskPayload {
  taskName: string;
  instructions?: string;
  assignTo: string;
  assignToName?: string;
  dept?: string;
  priority?: string;
  deadline?: string;
  mode?: string;
  assignedBy?: string;
  subTasks?: Array<{
    name: string;
    checklist?: string[];
  }>;
  attachments?: Array<{
    name: string;
    url: string;
    type?: string;
  }>;
}

export class TaskService {
  /**
   * Helper to generate next sequential ID with prefix (e.g. TSK-001, SUB-001, ITM-001, RMK-001)
   */
  private static async getNextId(prefix: string, table: 'main' | 'sub' | 'checklist' | 'remark' | 'attach'): Promise<string> {
    let maxN = 0;
    if (table === 'main') {
      const all = await prisma.taskMain.findMany({ select: { taskId: true } });
      for (const item of all) {
        if (item.taskId.startsWith(prefix)) {
          const n = parseInt(item.taskId.substring(prefix.length), 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      }
    } else if (table === 'sub') {
      const all = await prisma.taskSub.findMany({ select: { subTaskId: true } });
      for (const item of all) {
        if (item.subTaskId.startsWith(prefix)) {
          const n = parseInt(item.subTaskId.substring(prefix.length), 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      }
    } else if (table === 'checklist') {
      const all = await prisma.taskChecklist.findMany({ select: { itemId: true } });
      for (const item of all) {
        if (item.itemId.startsWith(prefix)) {
          const n = parseInt(item.itemId.substring(prefix.length), 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      }
    } else if (table === 'remark') {
      const all = await prisma.taskRemark.findMany({ select: { remarkId: true } });
      for (const item of all) {
        if (item.remarkId.startsWith(prefix)) {
          const n = parseInt(item.remarkId.substring(prefix.length), 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      }
    } else if (table === 'attach') {
      const all = await prisma.taskAttachment.findMany({ select: { attachId: true } });
      for (const item of all) {
        if (item.attachId.startsWith(prefix)) {
          const n = parseInt(item.attachId.substring(prefix.length), 10);
          if (!isNaN(n) && n > maxN) maxN = n;
        }
      }
    }
    return prefix + ('000' + (maxN + 1)).slice(-3);
  }

  /**
   * Recalculates progress (0-100%) for a task based on its checklist items.
   */
  public static async refreshTaskProgress(taskId: string): Promise<number> {
    const items = await prisma.taskChecklist.findMany({ where: { taskId } });
    if (items.length === 0) return 0;

    const doneCount = items.filter(it => it.isDone).length;
    const progress = Math.round((doneCount / items.length) * 100);

    await prisma.taskMain.update({
      where: { taskId },
      data: { progress, lastUpdated: new Date() },
    });

    // Outbox sync to Google Sheets
    try {
      const task = await prisma.taskMain.findUnique({ where: { taskId } });
      if (task) {
        await GoogleSheetsClient.syncTaskMainRow(env.APP_DB_SPREADSHEET_ID, {
          taskId: task.taskId,
          taskName: task.taskName,
          instructions: task.instructions || '',
          assignToId: task.assignToId,
          assignToName: task.assignToName,
          department: task.department,
          assignedBy: task.assignedBy,
          priority: task.priority,
          deadline: task.deadline || '',
          status: task.status,
          progress: task.progress,
          createdAt: task.createdAt.toISOString(),
          completedAt: task.completedAt ? task.completedAt.toISOString() : '',
          rating: task.rating != null ? task.rating : '',
          ratingRemark: task.ratingRemark || '',
          mode: task.mode,
          lastUpdated: task.lastUpdated.toISOString(),
        });
      }
    } catch (_) {}

    return progress;
  }

  /**
   * Fetch Task Dashboard (employees, tasks with progress, summary metrics)
   */
  public static async fetchTaskDashboard() {
    const employees = await prisma.employee.findMany({
      where: { status: { equals: 'active', mode: 'insensitive' } },
      orderBy: { name: 'asc' },
    });

    const tasksRaw = await prisma.taskMain.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        checklistItems: true,
      },
    });

    const now = new Date().getTime();
    const tasks: any[] = [];

    const summary = {
      total: 0,
      open: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      lateCompleted: 0,
      onTime: 0,
    };

    const assigneeMap = new Map<string, any>();
    const deptMap = new Map<string, any>();

    for (const t of tasksRaw) {
      // Calculate progress from checklist
      const items = t.checklistItems || [];
      let prog = t.progress;
      if (items.length > 0) {
        const done = items.filter(i => i.isDone).length;
        prog = Math.round((done / items.length) * 100);
      }

      const dead = t.deadline ? new Date(t.deadline).getTime() : null;
      const isCompleted = t.status === 'Completed';
      const isCancelled = t.status === 'Cancelled';
      const isOverdue = !!(dead && dead < now && !isCompleted && !isCancelled);

      let derivedStatus = t.status;
      if (!isCompleted && !isCancelled) {
        derivedStatus = isOverdue ? 'Overdue' : (prog > 0 ? 'In Progress' : 'Open');
      }

      let completedLate = false;
      if (isCompleted && dead && t.completedAt) {
        completedLate = t.completedAt.getTime() > dead;
      }

      summary.total++;
      if (derivedStatus === 'Completed') {
        summary.completed++;
        if (completedLate) summary.lateCompleted++;
        else summary.onTime++;
      } else if (derivedStatus === 'Cancelled') {
        summary.cancelled++;
      } else if (derivedStatus === 'Overdue') {
        summary.overdue++;
      } else if (derivedStatus === 'In Progress') {
        summary.inProgress++;
      } else {
        summary.open++;
      }

      // Assignee summary
      const aKey = `${t.assignToName} (${t.assignToId})`;
      if (!assigneeMap.has(aKey)) {
        assigneeMap.set(aKey, {
          name: aKey,
          dept: t.department,
          total: 0,
          open: 0,
          inProgress: 0,
          completed: 0,
          overdue: 0,
          late: 0,
          onTime: 0,
        });
      }
      const a = assigneeMap.get(aKey)!;
      a.total++;
      if (derivedStatus === 'Completed') {
        a.completed++;
        if (completedLate) a.late++;
        else a.onTime++;
      } else if (derivedStatus === 'Overdue') a.overdue++;
      else if (derivedStatus === 'In Progress') a.inProgress++;
      else if (derivedStatus !== 'Cancelled') a.open++;

      // Dept summary
      if (!deptMap.has(t.department)) {
        deptMap.set(t.department, {
          dept: t.department,
          total: 0,
          completed: 0,
          overdue: 0,
          active: 0,
        });
      }
      const d = deptMap.get(t.department)!;
      d.total++;
      if (derivedStatus === 'Completed') d.completed++;
      else if (derivedStatus === 'Overdue') d.overdue++;
      else if (derivedStatus !== 'Cancelled') d.active++;

      tasks.push({
        taskId: t.taskId,
        taskName: t.taskName,
        instructions: t.instructions,
        assignToId: t.assignToId,
        assignToName: t.assignToName,
        department: t.department,
        assignedBy: t.assignedBy,
        priority: t.priority,
        deadline: t.deadline,
        status: t.status,
        progress: prog,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt ? t.completedAt.toISOString() : '',
        rating: t.rating,
        ratingRemark: t.ratingRemark,
        mode: t.mode,
        overDue: isOverdue,
        completedLate,
        derivedStatus,
      });
    }

    return {
      employees: employees.map(e => ({ id: e.employeeId, name: e.name, dept: e.department })),
      tasks,
      summary,
      assigneeSummary: Array.from(assigneeMap.values()).sort((a, b) => b.total - a.total),
      deptSummary: Array.from(deptMap.values()).sort((a, b) => b.total - a.total),
    };
  }

  /**
   * Fetch details of a single task
   */
  public static async fetchTaskDetail(taskId: string) {
    const task = await prisma.taskMain.findUnique({
      where: { taskId },
      include: {
        subTasks: {
          orderBy: { orderNo: 'asc' },
          include: {
            items: true,
          },
        },
        checklistItems: true,
        attachments: {
          orderBy: { addedAt: 'desc' },
        },
        remarks: {
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found.`);
    }

    // Format subtasks with checklist items
    const subTasks = task.subTasks.map(sub => {
      const items = sub.items.map(it => ({
        itemId: it.itemId,
        text: it.itemText,
        done: it.isDone,
        doneAt: it.doneAt ? it.doneAt.toISOString() : '',
        doneBy: it.doneBy || '',
      }));
      const doneCount = items.filter(it => it.done).length;
      const progress = items.length ? Math.round((doneCount / items.length) * 100) : (sub.status === 'Done' ? 100 : 0);

      return {
        sid: sub.subTaskId,
        name: sub.subTaskName,
        orderNo: sub.orderNo,
        status: sub.status,
        progress,
        items,
      };
    });

    return {
      taskId: task.taskId,
      taskName: task.taskName,
      instructions: task.instructions,
      assignToId: task.assignToId,
      assignToName: task.assignToName,
      department: task.department,
      assignedBy: task.assignedBy,
      priority: task.priority,
      deadline: task.deadline,
      status: task.status,
      progress: task.progress,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : '',
      rating: task.rating,
      ratingRemark: task.ratingRemark,
      mode: task.mode,
      subTasks,
      attachments: task.attachments.map(att => ({
        attachId: att.attachId,
        fileName: att.fileName,
        url: att.url,
        type: att.type,
      })),
      remarks: task.remarks.map(rmk => ({
        remarkId: rmk.remarkId,
        text: rmk.remark,
        by: rmk.addedBy,
        at: rmk.addedAt.toISOString(),
      })),
    };
  }

  /**
   * Create and assign a new Task (writes to Supabase + pushes to Google Sheets)
   */
  public static async saveTask(payload: CreateTaskPayload) {
    const taskId = await this.getNextId('TSK-', 'main');
    const now = new Date();

    const assignToId = (payload.assignTo || '').trim();
    const assignToName = payload.assignToName || assignToId || 'Unassigned';
    const dept = (payload.dept || '').trim();
    const taskName = payload.taskName || '(Instructions Only Task)';
    const instructions = payload.instructions || '';
    const priority = payload.priority || 'Medium';
    const deadline = payload.deadline || '';
    const mode = payload.mode === 'Open' ? 'Open' : 'Checklist';
    const assignedBy = payload.assignedBy || 'Branch Head';

    // 1. Create Task in Supabase
    await prisma.taskMain.create({
      data: {
        taskId,
        taskName,
        instructions,
        assignToId,
        assignToName,
        department: dept,
        assignedBy,
        priority,
        deadline,
        status: 'Open',
        progress: 0,
        mode,
        createdAt: now,
        lastUpdated: now,
      },
    });

    // 2. Direct Sync to Google Sheets
    await GoogleSheetsClient.syncTaskMainRow(env.APP_DB_SPREADSHEET_ID, {
      taskId,
      taskName,
      instructions,
      assignToId,
      assignToName,
      department: dept,
      assignedBy,
      priority,
      deadline,
      status: 'Open',
      progress: 0,
      mode,
      createdAt: now.toISOString(),
      lastUpdated: now.toISOString(),
    }).catch(err => console.warn('SyncTaskMainRow warning:', err.message));

    // 3. Sub-Tasks & Checklist items
    let order = 1;
    const subTasks = payload.subTasks || [];
    for (const st of subTasks) {
      const sName = (st.name || '').trim();
      const checks = (st.checklist || []).map(c => c.trim()).filter(c => c !== '');
      if (!sName && checks.length === 0) continue;

      const subId = await this.getNextId('SUB-', 'sub');
      await prisma.taskSub.create({
        data: {
          subTaskId: subId,
          taskId,
          subTaskName: sName,
          orderNo: order,
          status: 'Open',
          createdAt: now,
        },
      });

      await GoogleSheetsClient.syncTaskSubRow(env.APP_DB_SPREADSHEET_ID, {
        subTaskId: subId,
        taskId,
        subTaskName: sName,
        orderNo: order,
        status: 'Open',
        createdAt: now.toISOString(),
      }).catch(() => {});

      if (checks.length > 0) {
        for (const c of checks) {
          const itmId = await this.getNextId('ITM-', 'checklist');
          await prisma.taskChecklist.create({
            data: {
              itemId: itmId,
              taskId,
              subTaskId: subId,
              itemText: c,
              isDone: false,
            },
          });

          await GoogleSheetsClient.syncChecklistItemRow(env.APP_DB_SPREADSHEET_ID, {
            itemId: itmId,
            taskId,
            subTaskId: subId,
            itemText: c,
            isDone: false,
          }).catch(() => {});
        }
      }
      order++;
    }

    // 4. Attachments
    const attachments = payload.attachments || [];
    for (const at of attachments) {
      if (!at.url) continue;
      const attId = await this.getNextId('ATT-', 'attach');
      await prisma.taskAttachment.create({
        data: {
          attachId: attId,
          taskId,
          fileName: at.name || 'attachment',
          url: at.url,
          type: at.type || 'file',
          addedAt: now,
        },
      });

      await GoogleSheetsClient.syncTaskAttachmentRow(env.APP_DB_SPREADSHEET_ID, {
        attachId: attId,
        taskId,
        fileName: at.name || 'attachment',
        url: at.url,
        type: at.type || 'file',
        addedAt: now.toISOString(),
      }).catch(() => {});
    }

    return { success: true, taskId };
  }

  /**
   * Update task status (Completed, Cancelled)
   */
  public static async updateTaskStatus(params: {
    taskId: string;
    status: 'Completed' | 'Cancelled' | 'Open' | 'In Progress';
    rating?: number;
    ratingRemark?: string;
    remark?: string;
    by?: string;
  }) {
    const task = await prisma.taskMain.findUnique({ where: { taskId: params.taskId } });
    if (!task) throw new Error('Task not found.');

    const now = new Date();
    const isCompleted = params.status === 'Completed';

    await prisma.taskMain.update({
      where: { taskId: params.taskId },
      data: {
        status: params.status,
        progress: isCompleted ? 100 : task.progress,
        completedAt: isCompleted ? now : task.completedAt,
        rating: isCompleted && params.rating != null ? params.rating : task.rating,
        ratingRemark: isCompleted && params.ratingRemark ? params.ratingRemark : task.ratingRemark,
        lastUpdated: now,
      },
    });

    if (params.remark) {
      await this.addTaskRemark(params.taskId, params.remark, params.by || 'Branch Head');
    }

    // Direct Google Sheets sync
    const updated = await prisma.taskMain.findUnique({ where: { taskId: params.taskId } });
    if (updated) {
      await GoogleSheetsClient.syncTaskMainRow(env.APP_DB_SPREADSHEET_ID, {
        taskId: updated.taskId,
        taskName: updated.taskName,
        instructions: updated.instructions || '',
        assignToId: updated.assignToId,
        assignToName: updated.assignToName,
        department: updated.department,
        assignedBy: updated.assignedBy,
        priority: updated.priority,
        deadline: updated.deadline || '',
        status: updated.status,
        progress: updated.progress,
        createdAt: updated.createdAt.toISOString(),
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : '',
        rating: updated.rating != null ? updated.rating : '',
        ratingRemark: updated.ratingRemark || '',
        mode: updated.mode,
        lastUpdated: updated.lastUpdated.toISOString(),
      }).catch(() => {});
    }

    return { success: true };
  }

  /**
   * Toggle a checklist item
   */
  public static async toggleChecklistItem(itemId: string, done: boolean, by = 'Branch Head') {
    const item = await prisma.taskChecklist.findUnique({ where: { itemId } });
    if (!item) throw new Error('Checklist item not found.');

    const now = new Date();
    await prisma.taskChecklist.update({
      where: { itemId },
      data: {
        isDone: done,
        doneAt: done ? now : null,
        doneBy: done ? by : null,
      },
    });

    // Refresh overall task progress
    await this.refreshTaskProgress(item.taskId);

    // Sync checklist item to Google Sheets
    await GoogleSheetsClient.syncChecklistItemRow(env.APP_DB_SPREADSHEET_ID, {
      itemId: item.itemId,
      taskId: item.taskId,
      subTaskId: item.subTaskId || '',
      itemText: item.itemText,
      isDone: done,
      doneAt: done ? now.toISOString() : '',
      doneBy: done ? by : '',
    }).catch(() => {});

    return { success: true, taskId: item.taskId };
  }

  /**
   * Add a new checklist item to a subtask
   */
  public static async addChecklistItem(taskId: string, subTaskId: string, itemText: string) {
    if (!itemText || !itemText.trim()) throw new Error('Item text cannot be empty.');

    const itemId = await this.getNextId('ITM-', 'checklist');
    await prisma.taskChecklist.create({
      data: {
        itemId,
        taskId,
        subTaskId,
        itemText: itemText.trim(),
        isDone: false,
      },
    });

    await this.refreshTaskProgress(taskId);

    await GoogleSheetsClient.syncChecklistItemRow(env.APP_DB_SPREADSHEET_ID, {
      itemId,
      taskId,
      subTaskId,
      itemText: itemText.trim(),
      isDone: false,
    }).catch(() => {});

    return { success: true, itemId };
  }

  /**
   * Add a task remark
   */
  public static async addTaskRemark(taskId: string, remark: string, by = 'Branch Head') {
    if (!remark || !remark.trim()) throw new Error('Remark cannot be empty.');

    const remarkId = await this.getNextId('RMK-', 'remark');
    const now = new Date();

    await prisma.taskRemark.create({
      data: {
        remarkId,
        taskId,
        remark: remark.trim(),
        addedBy: by,
        addedAt: now,
      },
    });

    await GoogleSheetsClient.syncTaskRemarkRow(env.APP_DB_SPREADSHEET_ID, {
      remarkId,
      taskId,
      remark: remark.trim(),
      addedBy: by,
      addedAt: now.toISOString(),
    }).catch(() => {});

    return { success: true, remarkId };
  }

  /**
   * Edit / update an existing task
   */
  public static async editTask(taskId: string, payload: {
    taskName?: string;
    instructions?: string;
    assignTo?: string;
    assignToName?: string;
    dept?: string;
    priority?: string;
    deadline?: string;
    mode?: string;
    assignedBy?: string;
    status?: string;
    subTasks?: Array<{
      sid?: string;
      name: string;
      checklist?: string[];
    }>;
    attachments?: Array<{
      name: string;
      url: string;
      type?: string;
    }>;
  }) {
    const existing = await prisma.taskMain.findUnique({
      where: { taskId },
      include: { subTasks: { include: { items: true } }, checklistItems: true },
    });
    if (!existing) {
      throw new Error(`Task ${taskId} not found.`);
    }

    const now = new Date();
    const updateData: any = {
      lastUpdated: now,
    };

    if (payload.taskName !== undefined) updateData.taskName = payload.taskName.trim() || existing.taskName;
    if (payload.instructions !== undefined) updateData.instructions = payload.instructions.trim();
    if (payload.assignTo !== undefined) {
      updateData.assignToId = payload.assignTo.trim();
      updateData.assignToName = payload.assignToName || payload.assignTo;
    }
    if (payload.dept !== undefined) updateData.department = payload.dept.trim();
    if (payload.priority !== undefined) updateData.priority = payload.priority;
    if (payload.deadline !== undefined) updateData.deadline = payload.deadline;
    if (payload.mode !== undefined) updateData.mode = payload.mode;
    if (payload.assignedBy !== undefined) updateData.assignedBy = payload.assignedBy;
    if (payload.status !== undefined) updateData.status = payload.status;

    // 1. Update TaskMain in Supabase
    await prisma.taskMain.update({
      where: { taskId },
      data: updateData,
    });

    // 2. If subTasks are supplied in edit payload, sync them:
    if (payload.subTasks && Array.isArray(payload.subTasks)) {
      // Delete old checklist items and subtasks for this task
      await prisma.taskChecklist.deleteMany({ where: { taskId } });
      await prisma.taskSub.deleteMany({ where: { taskId } });

      let order = 1;
      for (const st of payload.subTasks) {
        const sName = (st.name || '').trim();
        const checks = (st.checklist || []).map((c) => c.trim()).filter((c) => c !== '');
        if (!sName && checks.length === 0) continue;

        const subId = await this.getNextId('SUB-', 'sub');
        await prisma.taskSub.create({
          data: {
            subTaskId: subId,
            taskId,
            subTaskName: sName || 'General Tasks',
            orderNo: order,
            status: 'Open',
            createdAt: now,
          },
        });

        await GoogleSheetsClient.syncTaskSubRow(env.APP_DB_SPREADSHEET_ID, {
          subTaskId: subId,
          taskId,
          subTaskName: sName || 'General Tasks',
          orderNo: order,
          status: 'Open',
          createdAt: now.toISOString(),
        }).catch(() => {});

        for (const c of checks) {
          const itmId = await this.getNextId('ITM-', 'checklist');
          await prisma.taskChecklist.create({
            data: {
              itemId: itmId,
              taskId,
              subTaskId: subId,
              itemText: c,
              isDone: false,
            },
          });

          await GoogleSheetsClient.syncChecklistItemRow(env.APP_DB_SPREADSHEET_ID, {
            itemId: itmId,
            taskId,
            subTaskId: subId,
            itemText: c,
            isDone: false,
          }).catch(() => {});
        }
        order++;
      }
    }

    // 3. Recalculate progress
    await this.refreshTaskProgress(taskId);

    // 4. Sync updated TaskMain to Google Sheets
    const updated = await prisma.taskMain.findUnique({ where: { taskId } });
    if (updated) {
      await GoogleSheetsClient.syncTaskMainRow(env.APP_DB_SPREADSHEET_ID, {
        taskId: updated.taskId,
        taskName: updated.taskName,
        instructions: updated.instructions || '',
        assignToId: updated.assignToId,
        assignToName: updated.assignToName,
        department: updated.department,
        assignedBy: updated.assignedBy,
        priority: updated.priority,
        deadline: updated.deadline || '',
        status: updated.status,
        progress: updated.progress,
        createdAt: updated.createdAt.toISOString(),
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : '',
        rating: updated.rating != null ? updated.rating : '',
        ratingRemark: updated.ratingRemark || '',
        mode: updated.mode,
        lastUpdated: updated.lastUpdated.toISOString(),
      }).catch(() => {});
    }

    return { success: true, taskId };
  }

  /**
   * Delete an existing task (cascade delete in Supabase + clear row in Google Sheets)
   */
  public static async deleteTask(taskId: string) {
    const existing = await prisma.taskMain.findUnique({ where: { taskId } });
    if (!existing) {
      throw new Error(`Task ${taskId} not found.`);
    }

    // 1. Delete in database (Prisma handles cascade delete for subtasks, checklists, attachments, remarks)
    await prisma.taskMain.delete({
      where: { taskId },
    });

    // 2. Remove/clear from Google Sheets
    await GoogleSheetsClient.deleteTaskFromSheets(env.APP_DB_SPREADSHEET_ID, taskId).catch(() => {});

    return { success: true, taskId };
  }
}
