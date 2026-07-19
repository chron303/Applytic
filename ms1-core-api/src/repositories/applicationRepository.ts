import { pool } from "../db";

export interface Application {
  id: string;
  match_id: string;
  drafted_fields?: any;
  status: 'matched' | 'drafted' | 'reviewed' | 'submitted' | 'response_received' | 'interview' | 'offer' | 'rejected';
  submitted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export async function createApplication(application: Partial<Application>): Promise<Application> {
  const { match_id, drafted_fields, status = 'matched', submitted_at } = application;
  const result = await pool.query(
    `INSERT INTO applications (match_id, drafted_fields, status, submitted_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [match_id, drafted_fields, status, submitted_at]
  );
  return result.rows[0];
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const result = await pool.query(`SELECT * FROM applications WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function updateApplication(id: string, updates: Partial<Application>): Promise<Application | null> {
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
    return getApplicationById(id);
  }

  values.push(id);
  const query = `UPDATE applications SET ${setClause.join(', ')} WHERE id = $${index} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function listApplications(
  userId: string,
  status?: string,
  limit: number = 10,
  offset: number = 0
): Promise<Application[]> {
  let query = `
    SELECT a.* 
    FROM applications a
    JOIN matches m ON a.match_id = m.id
    WHERE m.user_id = $1
  `;
  const params: any[] = [userId];
  let index = 2;

  if (status) {
    query += ` AND a.status = $${index}`;
    params.push(status);
    index++;
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${index} OFFSET $${index + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}
