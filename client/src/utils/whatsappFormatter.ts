import { TaskItem, TaskDetailData } from '../types/admin';

/**
 * Formats a task into a clear, professional WhatsApp message ready to copy & paste.
 */
export function generateWhatsAppTaskMessage(
  task: TaskItem | TaskDetailData,
  detail?: TaskDetailData | null
): string {
  const d = detail || (task as TaskDetailData);

  let deadlineStr = 'Not Specified';
  if (task.deadline) {
    try {
      const dt = new Date(task.deadline);
      if (!isNaN(dt.getTime())) {
        deadlineStr = dt.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      } else {
        deadlineStr = task.deadline;
      }
    } catch {
      deadlineStr = task.deadline;
    }
  }

  let msg = `📌 *TASK ASSIGNMENT: The Prime Classes*\n`;
  msg += `────────────────────────────\n`;
  msg += `🆔 *Task ID:* ${task.taskId}\n`;
  msg += `📝 *Task:* ${task.taskName}\n`;
  msg += `👤 *Assigned To:* ${task.assignToName} (${task.assignToId})\n`;
  msg += `🏢 *Department:* ${task.department}\n`;
  msg += `⚡ *Priority:* ${task.priority}\n`;
  msg += `⏰ *Deadline:* ${deadlineStr}\n`;
  msg += `📊 *Status:* ${task.status} (${task.progress}%)\n`;
  msg += `────────────────────────────\n\n`;

  if (task.instructions && task.instructions.trim()) {
    msg += `📋 *Instructions & Details:*\n${task.instructions.trim()}\n\n`;
  }

  if (d && d.subTasks && d.subTasks.length > 0) {
    msg += `✅ *Checklist / Sub-Tasks:*\n`;
    d.subTasks.forEach((st, sIdx) => {
      msg += `*${sIdx + 1}. ${st.name || 'General Tasks'}*\n`;
      if (st.items && st.items.length > 0) {
        st.items.forEach((item) => {
          const mark = item.done ? '☑️' : '▫️';
          msg += `   ${mark} ${item.text}\n`;
        });
      }
    });
    msg += `\n`;
  }

  if (d && d.attachments && d.attachments.length > 0) {
    msg += `🔗 *Attachments & Resources:*\n`;
    d.attachments.forEach((att) => {
      msg += `• ${att.fileName}: ${att.url}\n`;
    });
    msg += `\n`;
  }

  msg += `────────────────────────────\n`;
  msg += `_Assigned by: ${task.assignedBy || 'Branch Head'} • Please acknowledge & update progress on the portal._`;

  return msg;
}

/**
 * Copies text to clipboard with fallback for non-secure contexts.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  // Fallback using textarea element
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}
