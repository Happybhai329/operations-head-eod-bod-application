import html2pdf from 'html2pdf.js';
import { EmployeeBodEodReportData, EmployeeReportDailyRecord } from '../types/admin';

// Helper to escape CSV values
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exports the employee BOD/EOD report as a detailed CSV file
 */
export function exportEmployeeBodEodToCSV(data: EmployeeBodEodReportData): void {
  const { employee, headName, dateRange, stats, records } = data;

  const headers = [
    'Date',
    'Employee ID',
    'Employee Name',
    'Department',
    'Role',
    'Evaluating Head',
    'Day Submission Status',
    'BOD Submitted',
    'EOD Submitted',
    'Approval Status',
    'System Score',
    'Head Rating',
    'Final Score',
    'Last Updated',
    'KRA / Category',
    'Task / Item Title',
    'Task Type',
    'BOD Target (Planned)',
    'EOD Achieved',
    'Task Status',
    'Is Voluntary',
    'Sub-Categories Breakdown',
    'BOD Remarks',
    'EOD Remarks',
  ];

  const rows: string[] = [];

  for (const day of records) {
    const baseInfo = [
      escapeCsv(day.date),
      escapeCsv(employee.id),
      escapeCsv(employee.name),
      escapeCsv(employee.department),
      escapeCsv(employee.role || 'employee'),
      escapeCsv(headName || 'Not Assigned'),
      escapeCsv(day.status),
      escapeCsv(day.bodSubmitted ? 'YES' : 'NO'),
      escapeCsv(day.eodSubmitted ? 'YES' : 'NO'),
      escapeCsv(day.approvalStatus),
      escapeCsv(day.systemScore !== null && day.systemScore !== undefined ? day.systemScore : ''),
      escapeCsv(day.headRating || ''),
      escapeCsv(day.finalScore !== null && day.finalScore !== undefined ? day.finalScore : ''),
      escapeCsv(day.lastUpdated || ''),
    ];

    if (!day.hasSubmission) {
      rows.push([...baseInfo, escapeCsv('N/A'), escapeCsv('No submission on this date'), escapeCsv('N/A'), escapeCsv(''), escapeCsv(''), escapeCsv('Not Done'), escapeCsv('NO'), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
      continue;
    }

    // Extract all unique KRA categories from both BOD and EOD
    const bodObj = typeof day.bodContent === 'object' && day.bodContent !== null ? day.bodContent : {};
    const eodObj = typeof day.eodContent === 'object' && day.eodContent !== null ? day.eodContent : {};
    const kraKeys = Array.from(new Set([...Object.keys(bodObj), ...Object.keys(eodObj)]));

    if (kraKeys.length === 0) {
      rows.push([...baseInfo, escapeCsv('General'), escapeCsv('No specific tasks listed'), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
      continue;
    }

    for (const kra of kraKeys) {
      const bodKra = bodObj[kra];
      const eodKra = eodObj[kra];

      const bodTask = typeof bodKra === 'object' && bodKra !== null ? bodKra : { value: bodKra };
      const eodTask = typeof eodKra === 'object' && eodKra !== null ? eodKra : { value: eodKra };

      const bodList = Array.isArray(bodTask.list) ? bodTask.list : [];
      const eodList = Array.isArray(eodTask.list) ? eodTask.list : [];

      const bodRemarks = bodTask.remarks || '';
      const eodRemarks = eodTask.remarks || '';

      const subCats = eodTask.subCategories || bodTask.subCategories;
      let subCatStr = '';
      if (subCats && typeof subCats === 'object') {
        subCatStr = Object.entries(subCats).map(([k, v]) => `${k}: ${v}`).join('; ');
      }

      if (bodList.length > 0 || eodList.length > 0) {
        const maxLen = Math.max(bodList.length, eodList.length);
        for (let i = 0; i < maxLen; i++) {
          const bItem = bodList[i] || {};
          const eItem = eodList[i] || {};
          const title = eItem.title || bItem.title || `Task #${i + 1}`;
          const target = bItem.target ?? eItem.target ?? (bItem.value ?? '');
          const achieved = eItem.achieved ?? (eItem.value ?? '');
          const status = eItem.status || bItem.status || '';
          const isVoluntary = bItem.isVoluntary || eItem.isVoluntary ? 'YES' : 'NO';

          rows.push([
            ...baseInfo,
            escapeCsv(kra),
            escapeCsv(title),
            escapeCsv('Dynamic Task'),
            escapeCsv(target),
            escapeCsv(achieved),
            escapeCsv(status),
            escapeCsv(isVoluntary),
            escapeCsv(subCatStr),
            escapeCsv(bodRemarks),
            escapeCsv(eodRemarks),
          ].join(','));
        }
      } else {
        // Single metric or checkbox task
        const isCheckbox = bodTask.type === 'checkbox' || eodTask.type === 'checkbox';
        const target = bodTask.target ?? bodTask.value ?? '';
        const achieved = eodTask.achieved ?? eodTask.value ?? '';
        const status = eodTask.status ?? (isCheckbox ? (achieved === 'Done' ? 'Done' : 'Not Done') : '');

        rows.push([
          ...baseInfo,
          escapeCsv(kra),
          escapeCsv(kra),
          escapeCsv(isCheckbox ? 'Checkbox' : 'Metric'),
          escapeCsv(target),
          escapeCsv(achieved),
          escapeCsv(status),
          escapeCsv('NO'),
          escapeCsv(subCatStr),
          escapeCsv(bodRemarks),
          escapeCsv(eodRemarks),
        ].join(','));
      }
    }
  }

  // Prepend summary rows at the top for clean analysis
  const summaryHeader = [
    `"=== THE PRIME CLASSES - EMPLOYEE BOD & EOD DOSSIER ==="`,
    `"Employee: ${employee.name} (${employee.id})"`,
    `"Department: ${employee.department}"`,
    `"Head: ${headName}"`,
    `"Date Range: ${dateRange.start} to ${dateRange.end} (${dateRange.totalDays} Days)"`,
    `"Submitted Days: ${stats.submittedDays} | Missed Days: ${stats.missedDays} | Avg Score: ${stats.avgScore ?? 'N/A'}%"`,
    `"Approved: ${stats.approvedDays} | Auto-Approved: ${stats.autoApprovedDays} | Pending: ${stats.pendingReviewDays}"`,
  ].join('\n');

  const csvContent = '\uFEFF' + summaryHeader + '\n\n' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `BOD_EOD_${employee.id}_${employee.name.replace(/\s+/g, '_')}_${dateRange.start}_to_${dateRange.end}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Builds HTML report string and triggers html2pdf generation
 */
export async function exportEmployeeBodEodToPDF(data: EmployeeBodEodReportData): Promise<void> {
  const { employee, headName, dateRange, stats, records } = data;

  const container = document.createElement('div');
  container.id = 'employee-report-pdf-root';
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '820px';
  container.style.backgroundColor = '#FFFFFF';
  container.style.color = '#0F172A';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  container.style.padding = '24px 30px';
  container.style.boxSizing = 'border-box';

  // Render day cards
  const renderDayHtml = (day: EmployeeReportDailyRecord, idx: number) => {
    if (!day.hasSubmission) {
      return `
        <div style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 14px; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 10px 14px; background-color: #F8FAFC;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 13px; color: #334155;">Day ${idx + 1} &bull; ${day.date}</span>
              <span style="background-color: #FEE2E2; color: #991B1B; font-weight: 700; font-size: 10px; padding: 2px 8px; border-radius: 4px;">❌ Not Submitted / Missed</span>
            </div>
            <span style="font-size: 11px; color: #94A3B8; font-style: italic;">No BOD or EOD recorded</span>
          </div>
        </div>
      `;
    }

    const bodObj = typeof day.bodContent === 'object' && day.bodContent !== null ? day.bodContent : {};
    const eodObj = typeof day.eodContent === 'object' && day.eodContent !== null ? day.eodContent : {};
    const kraKeys = Array.from(new Set([...Object.keys(bodObj), ...Object.keys(eodObj)]));

    let statusBg = '#E0F2FE';
    let statusText = '#0369A1';
    if (day.status === 'Both') {
      statusBg = '#DCFCE7';
      statusText = '#15803D';
    } else if (day.status === 'BOD Only') {
      statusBg = '#FEF3C7';
      statusText = '#B45309';
    }

    let approvalBg = '#F1F5F9';
    let approvalText = '#475569';
    if (day.approvalStatus === 'Approved') {
      approvalBg = '#DCFCE7';
      approvalText = '#166534';
    } else if (day.approvalStatus === 'Auto Approved') {
      approvalBg = '#F3E8FF';
      approvalText = '#6B21A8';
    } else if (day.approvalStatus === 'Pending Review') {
      approvalBg = '#FEF3C7';
      approvalText = '#92400E';
    }

    const kraCardsHtml = kraKeys.map((kra) => {
      const bKra = bodObj[kra] || {};
      const eKra = eodObj[kra] || {};
      const bTask = typeof bKra === 'object' && bKra !== null ? bKra : { value: bKra };
      const eTask = typeof eKra === 'object' && eKra !== null ? eKra : { value: eKra };

      const bList = Array.isArray(bTask.list) ? bTask.list : [];
      const eList = Array.isArray(eTask.list) ? eTask.list : [];
      const hasList = bList.length > 0 || eList.length > 0;
      const isCheckbox = bTask.type === 'checkbox' || eTask.type === 'checkbox';

      const subCats = eTask.subCategories || bTask.subCategories;
      const hasSubCats = subCats && typeof subCats === 'object' && Object.keys(subCats).length > 0;

      let itemsHtml = '';
      if (hasList) {
        const maxLen = Math.max(bList.length, eList.length);
        const itemRows = [];
        for (let i = 0; i < maxLen; i++) {
          const b = bList[i] || {};
          const e = eList[i] || {};
          const title = e.title || b.title || `Task #${i + 1}`;
          const target = b.target ?? e.target ?? (b.value !== undefined ? b.value : '—');
          const achieved = e.achieved ?? (e.value !== undefined ? e.value : '—');
          const isDone = e.status === 'Done' || e.status === 'done' || e.status === true || e.status === '1';

          itemRows.push(`
            <tr style="border-bottom: 1px solid #F1F5F9; font-size: 11px;">
              <td style="padding: 5px 8px; font-weight: 600; color: #1E293B;">
                ${title}
                ${(b.isVoluntary || e.isVoluntary) ? '<span style="background-color: #FEF3C7; color: #B45309; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px; font-weight: 700;">⭐ Voluntary</span>' : ''}
              </td>
              <td style="padding: 5px 8px; text-align: center; font-family: monospace; font-weight: 700; color: #047857;">${target}</td>
              <td style="padding: 5px 8px; text-align: center; font-family: monospace; font-weight: 700; color: #4338CA;">${achieved}</td>
              <td style="padding: 5px 8px; text-align: right;">
                <span style="display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background-color: ${isDone ? '#DCFCE7' : '#FEE2E2'}; color: ${isDone ? '#15803D' : '#991B1B'};">
                  ${e.status || (isDone ? 'Done' : 'Pending')}
                </span>
              </td>
            </tr>
          `);
        }
        itemsHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px; background-color: #F8FAFC; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #F1F5F9; font-size: 10px; text-transform: uppercase; color: #64748B;">
                <th style="padding: 4px 8px; text-align: left;">Task / Item Description</th>
                <th style="padding: 4px 8px; text-align: center; width: 85px;">BOD Target</th>
                <th style="padding: 4px 8px; text-align: center; width: 85px;">EOD Achieved</th>
                <th style="padding: 4px 8px; text-align: right; width: 85px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows.join('')}
            </tbody>
          </table>
        `;
      } else if (isCheckbox) {
        const isDone = eTask.status === 'Done' || eTask.value === 'Done' || eTask.status === true;
        itemsHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; background-color: #F8FAFC; padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-top: 4px;">
            <span style="color: #475569; font-weight: 600;">Checklist Requirement:</span>
            <span style="padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; background-color: ${isDone ? '#DCFCE7' : '#FEE2E2'}; color: ${isDone ? '#15803D' : '#991B1B'};">
              ${isDone ? '✅ Done' : '❌ Not Done'}
            </span>
          </div>
        `;
      } else {
        const target = bTask.target ?? bTask.value ?? 'N/A';
        const achieved = eTask.achieved ?? eTask.value ?? 'N/A';
        itemsHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; background-color: #F8FAFC; padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-top: 4px;">
            <span style="color: #475569; font-weight: 600;">Metric Target vs Accomplishment:</span>
            <div style="display: flex; gap: 12px; font-family: monospace; font-size: 11px;">
              <span>Target: <strong style="color: #047857;">${target}</strong></span>
              <span style="color: #CBD5E1;">|</span>
              <span>Achieved: <strong style="color: #4338CA;">${achieved}</strong></span>
            </div>
          </div>
        `;
      }

      let subCatsHtml = '';
      if (hasSubCats) {
        const pills = Object.entries(subCats).map(([k, v]) => `
          <span style="background-color: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">
            ${k}: <strong>${v}</strong>
          </span>
        `).join(' ');
        subCatsHtml = `<div style="margin-top: 5px; display: flex; flex-wrap: wrap; gap: 4px;">${pills}</div>`;
      }

      const remarks = eTask.remarks || bTask.remarks || '';
      let remarksHtml = '';
      if (remarks) {
        remarksHtml = `
          <div style="margin-top: 4px; background-color: #FFFBEB; border-left: 3px solid #F59E0B; padding: 4px 8px; font-size: 10px; color: #92400E; border-radius: 0 4px 4px 0;">
            <strong>Remarks:</strong> ${remarks}
          </div>
        `;
      }

      return `
        <div style="margin-top: 8px; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px; background-color: #FFFFFF;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; color: #041C32;">
            <span>📌 ${kra}</span>
          </div>
          ${itemsHtml}
          ${subCatsHtml}
          ${remarksHtml}
        </div>
      `;
    }).join('');

    return `
      <div style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 16px; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); background-color: #FFFFFF;">
        <!-- Day Card Header -->
        <div style="background-color: #041C32; color: #FFFFFF; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: 800; font-size: 13px; color: #F5D042;">📅 ${day.date}</span>
            <span style="background-color: ${statusBg}; color: ${statusText}; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">
              ${day.status}
            </span>
            <span style="background-color: ${approvalBg}; color: ${approvalText}; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">
              ${day.approvalStatus}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 11px;">
            <span>System Score: <strong style="color: #67E8F9;">${day.systemScore ?? '—'}</strong></span>
            <span>Head Rating: <strong style="color: #FDE047;">${day.headRating ?? '—'}${day.headRating ? '%' : ''}</strong></span>
            <span>Final Score: <strong style="color: #86EFAC;">${day.finalScore ?? '—'}</strong></span>
          </div>
        </div>

        <!-- Day Card Body -->
        <div style="padding: 8px 12px;">
          ${kraCardsHtml || '<div style="font-size: 11px; color: #94A3B8; italic">No detailed tasks recorded.</div>'}
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    <!-- MAIN CORPORATE HEADER -->
    <div style="border-bottom: 2px solid #041C32; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #041C32; letter-spacing: -0.5px;">
            THE PRIME CLASSES
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #B45309; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
            Branch Head & Super Admin Performance Portal
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #1E293B; margin-top: 6px;">
            Employee BOD & EOD Performance Dossier
          </div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background-color: #041C32; color: #F5D042; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 6px;">
            OFFICIAL REPORT
          </div>
          <div style="font-size: 10px; color: #64748B; margin-top: 4px;">
            Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>

    <!-- EMPLOYEE & FILTER DETAILS CARD -->
    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; font-size: 11px;">
        <div>
          <span style="color: #64748B; font-weight: 600; display: block; font-size: 10px; text-transform: uppercase;">Employee Name</span>
          <span style="font-weight: 800; color: #0F172A; font-size: 13px;">${employee.name}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600; display: block; font-size: 10px; text-transform: uppercase;">Employee ID</span>
          <span style="font-family: monospace; font-weight: 800; color: #0F172A; font-size: 13px;">${employee.id}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600; display: block; font-size: 10px; text-transform: uppercase;">Department & Role</span>
          <span style="font-weight: 700; color: #0F172A;">${employee.department} &bull; ${employee.role || 'Staff'}</span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600; display: block; font-size: 10px; text-transform: uppercase;">Evaluating Head</span>
          <span style="font-weight: 700; color: #4338CA;">${headName || 'Not Assigned'}</span>
        </div>
      </div>

      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
        <div>
          <span style="color: #64748B; font-weight: 600;">Audit Filter Period: </span>
          <strong style="color: #041C32;">${dateRange.start}</strong> to <strong style="color: #041C32;">${dateRange.end}</strong>
          <span style="background-color: #E2E8F0; color: #334155; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">
            ${dateRange.totalDays} Total Days
          </span>
        </div>
        <div>
          <span style="color: #64748B; font-weight: 600;">Overall Period Average: </span>
          <strong style="font-size: 13px; color: ${stats.avgScore && stats.avgScore >= 80 ? '#15803D' : stats.avgScore && stats.avgScore >= 60 ? '#B45309' : '#B91C1C'};">
            ${stats.avgScore !== null && stats.avgScore !== undefined ? stats.avgScore + '%' : 'N/A'}
          </strong>
        </div>
      </div>
    </div>

    <!-- STATISTICAL EXECUTIVE SUMMARY -->
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 20px;">
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Days</div>
        <div style="font-size: 16px; font-weight: 800; color: #0F172A; margin-top: 2px;">${stats.totalDays}</div>
      </div>
      <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: #065F46; text-transform: uppercase;">Submitted</div>
        <div style="font-size: 16px; font-weight: 800; color: #047857; margin-top: 2px;">${stats.submittedDays}</div>
      </div>
      <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: #166534; text-transform: uppercase;">Both BOD+EOD</div>
        <div style="font-size: 16px; font-weight: 800; color: #15803D; margin-top: 2px;">${stats.bothSubmittedDays}</div>
      </div>
      <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: #92400E; text-transform: uppercase;">Partial Only</div>
        <div style="font-size: 16px; font-weight: 800; color: #B45309; margin-top: 2px;">${stats.bodOnlyDays + stats.eodOnlyDays}</div>
      </div>
      <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: #991B1B; text-transform: uppercase;">Missed / None</div>
        <div style="font-size: 16px; font-weight: 800; color: #DC2626; margin-top: 2px;">${stats.missedDays}</div>
      </div>
      <div style="background-color: #FAF5FF; border: 1px solid #E9D5FF; border-radius: 6px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: #6B21A8; text-transform: uppercase;">Approved</div>
        <div style="font-size: 16px; font-weight: 800; color: #7E22CE; margin-top: 2px;">${stats.approvedDays + stats.autoApprovedDays}</div>
      </div>
    </div>

    <!-- DETAILED DAILY SUBMISSIONS TITLE -->
    <div style="font-size: 12px; font-weight: 800; color: #041C32; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px;">
      <span>Daily BOD Targets & EOD Accomplishments Breakdown</span>
      <span style="font-size: 10px; color: #64748B; font-weight: 600;">Chronological Order</span>
    </div>

    <!-- DAILY CARDS -->
    <div>
      ${records.map((r, i) => renderDayHtml(r, i)).join('')}
    </div>

    <!-- REPORT FOOTER -->
    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #CBD5E1; display: flex; justify-content: space-between; font-size: 9px; color: #94A3B8;">
      <span>The Prime Classes &bull; Confidential Performance System Dossier</span>
      <span>Emp ID: ${employee.id} &bull; Generated for Management Review</span>
    </div>
  `;

  document.body.appendChild(container);

  const cleanEmpName = employee.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `BOD_EOD_${employee.id}_${cleanEmpName}_${dateRange.start}_to_${dateRange.end}.pdf`;

  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
    pagebreak: { mode: ['css', 'legacy'] },
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    throw err;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
