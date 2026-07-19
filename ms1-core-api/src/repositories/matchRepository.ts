import { pool } from "../db";

export interface Match {
  id: string;
  user_id: string;
  posting_id: string;
  match_score?: number;
  match_result: 'apply' | 'maybe' | 'skip';
  reasoning?: string;
  created_at: Date;
}

export async function createMatch(match: Partial<Match>): Promise<Match> {
  const { user_id, posting_id, match_score, match_result, reasoning } = match;
  const result = await pool.query(
    `INSERT INTO matches (user_id, posting_id, match_score, match_result, reasoning)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [user_id, posting_id, match_score, match_result, reasoning]
  );
  return result.rows[0];
}

export async function getMatchById(id: string): Promise<Match | null> {
  const result = await pool.query(`SELECT * FROM matches WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function updateMatch(id: string, updates: Partial<Match>): Promise<Match | null> {
  const setClause = [];
  const values: any[] = [];
  let index = 1;
  for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
          setClause.push(`${key} = $${index}`);
          values.push(value);
          index++;
      }
  }
  
  if (setClause.length === 0) { 
      return getMatchById(id);
  }

  values.push(id);
  const query = `UPDATE matches SET ${setClause.join(', ')} WHERE id = $${index} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function listMatches(limit: number = 10, offset: number = 0): Promise<Match[]> {
    const result = await pool.query(`SELECT * FROM matches ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return result.rows;
}
