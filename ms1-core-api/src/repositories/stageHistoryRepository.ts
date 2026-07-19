import { pool } from "../db";

export interface StageHistory {
  id: string;
  application_id: string;
  from_status?: string;
  to_status?: string;
  changed_by?: string;
  notes?: string;
  changed_at: Date;
}

export async function createStageHistory(history: Partial<StageHistory>): Promise<StageHistory> {
  const { application_id, from_status, to_status, changed_by, notes } = history;
  const result = await pool.query(
    `INSERT INTO stage_history (application_id, from_status, to_status, changed_by, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [application_id, from_status, to_status, changed_by, notes]
  );
  return result.rows[0];
}

export async function getStageHistoryById(id: string): Promise<StageHistory | null> {
  const result = await pool.query(`SELECT * FROM stage_history WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function updateStageHistory(id: string, updates: Partial<StageHistory>): Promise<StageHistory | null> {
  const setClause = [];
  const values: any[] = [];
  let index = 1;
  
  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'changed_at') {
      setClause.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }
  }
  
  if (setClause.length === 0) {
    return getStageHistoryById(id);
  }

  values.push(id);
  const query = `UPDATE stage_history SET ${setClause.join(', ')} WHERE id = $${index} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function listStageHistories(limit: number = 10, offset: number = 0): Promise<StageHistory[]> {
  const result = await pool.query(
    `SELECT * FROM stage_history ORDER BY changed_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}
