import { google, sheets_v4 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

export class GoogleSheetsClient {
  private static sheetsApi: sheets_v4.Sheets | null = null;
  private static isInitialized = false;

  /**
   * Initializes and returns the authenticated Google Sheets API client.
   */
  public static getClient(): sheets_v4.Sheets | null {
    if (this.sheetsApi) return this.sheetsApi;
    if (this.isInitialized) return null; // Already tried and failed or disabled

    try {
      let auth;

      // 1. Try stringified JSON credentials in env vars (Cloud / Docker / Render deployments)
      const rawJson = process.env.GOOGLE_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || env.GOOGLE_CREDENTIALS_JSON || env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (rawJson && typeof rawJson === 'string' && rawJson.trim().startsWith('{')) {
        try {
          const creds = JSON.parse(rawJson.trim());
          if (creds.client_email && creds.private_key) {
            auth = new google.auth.JWT({
              email: creds.client_email,
              key: creds.private_key.replace(/\\n/g, '\n'),
              scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            console.log('🔑 Authenticated Google Sheets API using stringified JSON credentials from environment.');
          }
        } catch (e: any) {
          console.warn('⚠️ Failed to parse stringified Google Service Account JSON from environment:', e.message);
        }
      }

      // 2. Try discrete email & key env credentials
      if (!auth && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
        auth = new google.auth.JWT({
          email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      }

      // 3. Try JSON key file in server or root
      if (!auth) {
        const potentialKeyPaths = [
          env.GOOGLE_CREDENTIALS_PATH,
          path.resolve(__dirname, '../../credentials.json'),
          path.resolve(__dirname, '../../../credentials.json'),
          path.resolve('D:/prime/standard-gcp-project-485906-275666f71217.json'),
          path.resolve('D:/prime/eod bod full stack/standard-gcp-project-485906-9d8a01147378.json'),
        ].filter(Boolean) as string[];

        for (const p of potentialKeyPaths) {
          if (fs.existsSync(p)) {
            const keyFile = JSON.parse(fs.readFileSync(p, 'utf-8'));
            auth = new google.auth.JWT({
              email: keyFile.client_email,
              key: keyFile.private_key,
              scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            console.log(`🔑 Authenticated Google Sheets API using key file: ${p}`);
            break;
          }
        }
      }

      if (auth) {
        this.sheetsApi = google.sheets({ version: 'v4', auth });
        this.isInitialized = true;
        return this.sheetsApi;
      }
    } catch (err) {
      console.warn('⚠️ Google Sheets authentication could not be established:', err);
    }

    this.isInitialized = true;
    return null;
  }

  /**
   * Reads raw values from a spreadsheet and range.
   */
  public static async getValues(spreadsheetId: string, range: string): Promise<any[][] | null> {
    const client = this.getClient();
    if (!client) {
      throw new Error('Google Sheets client is not configured with credentials.');
    }

    const response = await client.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  }

  /**
   * Appends or updates a row in the Head_Ratings sheet.
   */
  public static async syncHeadRatingRow(
    spreadsheetId: string,
    ratingPayload: {
      date: string;
      department: string;
      headId: string;
      baseScore: string;
      adminRating: string;
      finalHeadScore: string;
      updatedAt: string;
    }
  ): Promise<{ updated: boolean; rowIndex: number }> {
    const client = this.getClient();
    if (!client) {
      throw new Error('Google Sheets client is not configured.');
    }

    // 1. Fetch current rows from Head_Ratings sheet
    let rows: any[][] = [];
    try {
      const res = await client.spreadsheets.values.get({
        spreadsheetId,
        range: 'Head_Ratings!A:G',
      });
      rows = res.data.values || [];
    } catch (err: any) {
      // If sheet doesn't exist, create it with header
      if (err.message && err.message.includes('Unable to parse range')) {
        await client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: 'Head_Ratings' } } }],
          },
        });
        await client.spreadsheets.values.append({
          spreadsheetId,
          range: 'Head_Ratings!A1:G1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Date', 'Department', 'HeadId', 'Base_Score_%', 'Admin_Rating_%', 'Final_Head_Score_%', 'Updated_At'],
            ],
          },
        });
        rows = [['Date', 'Department', 'HeadId', 'Base_Score_%', 'Admin_Rating_%', 'Final_Head_Score_%', 'Updated_At']];
      } else {
        throw err;
      }
    }

    // Find if row for (date, department) already exists
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const rDate = rows[i][0];
      const rDept = rows[i][1];
      if (rDate === ratingPayload.date && rDept === ratingPayload.department) {
        rowIndex = i + 1; // 1-indexed for Sheets API
        break;
      }
    }

    const rowData = [
      ratingPayload.date,
      ratingPayload.department,
      ratingPayload.headId,
      ratingPayload.baseScore,
      ratingPayload.adminRating,
      ratingPayload.finalHeadScore,
      ratingPayload.updatedAt,
    ];

    if (rowIndex !== -1) {
      // Update existing row
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `Head_Ratings!A${rowIndex}:G${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
      return { updated: true, rowIndex };
    } else {
      // Append new row
      const appendRes = await client.spreadsheets.values.append({
        spreadsheetId,
        range: 'Head_Ratings!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
      return { updated: false, rowIndex: rows.length + 1 };
    }
  }

  /**
   * Appends or updates a row in Tasks_Main without touching headers.
   */
  public static async syncTaskMainRow(
    spreadsheetId: string,
    task: {
      taskId: string;
      taskName: string;
      instructions?: string;
      assignToId: string;
      assignToName: string;
      department: string;
      assignedBy?: string;
      priority?: string;
      deadline?: string;
      status?: string;
      progress?: number;
      createdAt?: string;
      completedAt?: string;
      rating?: number | string;
      ratingRemark?: string;
      mode?: string;
      lastUpdated?: string;
    }
  ): Promise<void> {
    const client = this.getClient();
    if (!client) throw new Error('Google Sheets client is not configured.');

    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: 'Tasks_Main!A:Q',
    });
    const rows = res.data.values || [];

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === task.taskId) {
        rowIndex = i + 1;
        break;
      }
    }

    const rowData = [
      task.taskId,
      task.taskName,
      task.instructions || '',
      task.assignToId,
      task.assignToName,
      task.department,
      task.assignedBy || 'Branch Head',
      task.priority || 'Medium',
      task.deadline || '',
      task.status || 'Open',
      task.progress ?? 0,
      task.createdAt || new Date().toISOString(),
      task.completedAt || '',
      task.rating != null ? String(task.rating) : '',
      task.ratingRemark || '',
      task.mode || 'Checklist',
      task.lastUpdated || new Date().toISOString(),
    ];

    if (rowIndex !== -1) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `Tasks_Main!A${rowIndex}:Q${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: 'Tasks_Main!A:Q',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    }
  }

  /**
   * Appends or updates a row in Tasks_Sub.
   */
  public static async syncTaskSubRow(
    spreadsheetId: string,
    sub: {
      subTaskId: string;
      taskId: string;
      subTaskName: string;
      orderNo: number;
      status?: string;
      createdAt?: string;
    }
  ): Promise<void> {
    const client = this.getClient();
    if (!client) throw new Error('Google Sheets client is not configured.');

    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: 'Tasks_Sub!A:F',
    });
    const rows = res.data.values || [];

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === sub.subTaskId) {
        rowIndex = i + 1;
        break;
      }
    }

    const rowData = [
      sub.subTaskId,
      sub.taskId,
      sub.subTaskName,
      sub.orderNo,
      sub.status || 'Open',
      sub.createdAt || new Date().toISOString(),
    ];

    if (rowIndex !== -1) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `Tasks_Sub!A${rowIndex}:F${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: 'Tasks_Sub!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    }
  }

  /**
   * Appends or updates a row in Tasks_Checklist.
   */
  public static async syncChecklistItemRow(
    spreadsheetId: string,
    item: {
      itemId: string;
      taskId: string;
      subTaskId?: string;
      itemText: string;
      isDone: boolean;
      doneAt?: string;
      doneBy?: string;
    }
  ): Promise<void> {
    const client = this.getClient();
    if (!client) throw new Error('Google Sheets client is not configured.');

    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: 'Tasks_Checklist!A:G',
    });
    const rows = res.data.values || [];

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === item.itemId) {
        rowIndex = i + 1;
        break;
      }
    }

    const rowData = [
      item.itemId,
      item.taskId,
      item.subTaskId || '',
      item.itemText,
      item.isDone ? 'TRUE' : 'FALSE',
      item.doneAt || '',
      item.doneBy || '',
    ];

    if (rowIndex !== -1) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `Tasks_Checklist!A${rowIndex}:G${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: 'Tasks_Checklist!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    }
  }

  /**
   * Appends an attachment to Tasks_Attachments.
   */
  public static async syncTaskAttachmentRow(
    spreadsheetId: string,
    att: {
      attachId: string;
      taskId: string;
      fileName: string;
      url: string;
      type?: string;
      addedAt?: string;
    }
  ): Promise<void> {
    const client = this.getClient();
    if (!client) throw new Error('Google Sheets client is not configured.');

    const rowData = [
      att.attachId,
      att.taskId,
      att.fileName,
      att.url,
      att.type || 'file',
      att.addedAt || new Date().toISOString(),
    ];

    await client.spreadsheets.values.append({
      spreadsheetId,
      range: 'Tasks_Attachments!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowData] },
    });
  }

  /**
   * Appends a remark to Tasks_Remarks.
   */
  public static async syncTaskRemarkRow(
    spreadsheetId: string,
    rmk: {
      remarkId: string;
      taskId: string;
      remark: string;
      addedBy?: string;
      addedAt?: string;
    }
  ): Promise<void> {
    const client = this.getClient();
    if (!client) throw new Error('Google Sheets client is not configured.');

    const rowData = [
      rmk.remarkId,
      rmk.taskId,
      rmk.remark,
      rmk.addedBy || 'Branch Head',
      rmk.addedAt || new Date().toISOString(),
    ];

    await client.spreadsheets.values.append({
      spreadsheetId,
      range: 'Tasks_Remarks!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowData] },
    });
  }

  /**
   * Updates or appends a Daily Report in Daily_Reports without modifying headers.
   */
  public static async syncDailyReportRow(
    spreadsheetId: string,
    report: {
      reportDate: string;
      employeeId: string;
      departmentName: string;
      bodData?: any;
      eodData?: any;
      systemScore?: number;
      lastUpdated?: string;
      headRating?: string;
      finalScore?: number;
    }
  ): Promise<void> {
    const client = this.getClient();
    if (!client) throw new Error('Google Sheets client is not configured.');

    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: 'Daily_Reports!A:I',
    });
    const rows = res.data.values || [];

    const targetDate = report.reportDate.trim();
    const targetEmp = report.employeeId.trim().toUpperCase();

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const rDate = String(rows[i][0] || '').trim();
      const rEmp = String(rows[i][1] || '').trim().toUpperCase();
      if (rDate === targetDate && rEmp === targetEmp) {
        rowIndex = i + 1;
        break;
      }
    }

    const bodStr = typeof report.bodData === 'string' ? report.bodData : JSON.stringify(report.bodData || {});
    const eodStr = typeof report.eodData === 'string' ? report.eodData : JSON.stringify(report.eodData || {});

    const rowData = [
      report.reportDate,
      report.employeeId,
      report.departmentName,
      bodStr,
      eodStr,
      report.systemScore != null ? report.systemScore : '',
      report.lastUpdated || new Date().toISOString(),
      report.headRating || '',
      report.finalScore != null ? report.finalScore : '',
    ];

    if (rowIndex !== -1) {
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `Daily_Reports!A${rowIndex}:I${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    } else {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: 'Daily_Reports!A:I',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] },
      });
    }
  }

  /**
   * Clears a deleted task row in Tasks_Main without affecting other rows or headers.
   */
  public static async deleteTaskFromSheets(spreadsheetId: string, taskId: string): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const res = await client.spreadsheets.values.get({
        spreadsheetId,
        range: 'Tasks_Main!A:Q',
      });
      const rows = res.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0] || '').trim() === taskId.trim()) {
          const rowIndex = i + 1;
          await client.spreadsheets.values.clear({
            spreadsheetId,
            range: `Tasks_Main!A${rowIndex}:Q${rowIndex}`,
          });
          break;
        }
      }
    } catch (err: any) {
      console.warn('deleteTaskFromSheets warning:', err.message);
    }
  }
}

