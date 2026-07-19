import { pool } from "../db";

export interface Posting {
  id: string;
  source: string;
  external_id: string;
  company: string;
  title: string;
  location?: string;
  employment_type?: string;
  remote?: boolean;
  raw_description?: string;
  source_url?: string;
  status: 'active' | 'stale' | 'archived';
  last_seen_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export async function createPosting(posting: Partial<Posting>): Promise<Posting> {
  const { 
    source, external_id, company, title, location, 
    employment_type, remote, raw_description, source_url, 
    status = 'active', last_seen_at 
  } = posting;
  
  const result = await pool.query(
    `INSERT INTO postings (source, external_id, company, title, location, employment_type, remote, raw_description, source_url, status, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [source, external_id, company, title, location, employment_type, remote, raw_description, source_url, status, last_seen_at]
  );
  return result.rows[0];
}

export async function getPostingById(id: string): Promise<Posting | null> {
  const result = await pool.query(`SELECT * FROM postings WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function updatePosting(id: string, updates: Partial<Posting>): Promise<Posting | null> {
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
    return getPostingById(id);
  }

  values.push(id);
  const query = `UPDATE postings SET ${setClause.join(', ')} WHERE id = $${index} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function listPostings(limit: number = 10, offset: number = 0, status?: string): Promise<Posting[]> {
  let query = `SELECT * FROM postings`;
  const values: any[] = [];
  let index = 1;

  if (status) {
    query += ` WHERE status = $${index}`;
    values.push(status);
    index++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${index} OFFSET $${index + 1}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows;
}
