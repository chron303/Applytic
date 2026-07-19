import { pool } from "../db";

export interface Requirement {
  id: string;
  posting_id: string;
  structured_data?: any;
  parser_version?: string;
  confidence_score?: any;
  created_at: Date;
  updated_at: Date;
}

export async function createRequirement(requirement: Partial<Requirement>): Promise<Requirement> {
  const { posting_id, structured_data, parser_version, confidence_score } = requirement;
  const result = await pool.query(
    `INSERT INTO requirements (posting_id, structured_data, parser_version, confidence_score)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [posting_id, structured_data, parser_version, confidence_score]
  );
  return result.rows[0];
}

export async function getRequirementById(id: string): Promise<Requirement | null> {
  const result = await pool.query(`SELECT * FROM requirements WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function updateRequirement(id: string, updates: Partial<Requirement>): Promise<Requirement | null> {
  const setClause = [];
  const values: any[] = [];
  let index = 1;
  
  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
      setClause.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }
  }
  
  setClause.push(`updated_at = NOW()`);
  
  if (setClause.length === 1) {
    return getRequirementById(id);
  }

  values.push(id);
  const query = `UPDATE requirements SET ${setClause.join(', ')} WHERE id = $${index} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function listRequirements(limit: number = 10, offset: number = 0): Promise<Requirement[]> {
  const result = await pool.query(
    `SELECT * FROM requirements ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function getRequirementsByPostingId(postingId: string): Promise<Requirement[]> {
  const result = await pool.query(
    `SELECT * FROM requirements WHERE posting_id = $1 ORDER BY created_at DESC`,
    [postingId]
  );
  return result.rows;
}
