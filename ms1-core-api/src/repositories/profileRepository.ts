import { pool } from "../db";

export interface Profile {
  id: string;
  user_id: string;
  resume_url?: string;
  raw_resume_text?: string;
  parsed_data?: any;
  parser_version?: string;
  field_confidence?: any;
  created_at: Date;
  updated_at: Date;
}

export async function createProfile(profile: Partial<Profile>): Promise<Profile> {
  const { user_id, resume_url, raw_resume_text, parsed_data, parser_version, field_confidence } = profile;
  const result = await pool.query(
    `INSERT INTO profiles (user_id, resume_url, raw_resume_text, parsed_data, parser_version, field_confidence)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         resume_url = EXCLUDED.resume_url,
         raw_resume_text = EXCLUDED.raw_resume_text,
         parsed_data = EXCLUDED.parsed_data,
         parser_version = EXCLUDED.parser_version,
         field_confidence = EXCLUDED.field_confidence,
         updated_at = NOW()
       RETURNING *`,
    [user_id, resume_url, raw_resume_text, parsed_data, parser_version, field_confidence]
  );
  return result.rows[0];
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const result = await pool.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]);
  return result.rows[0] || null;
}

export async function updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null> {
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
    return getProfileByUserId(id);
  }

  values.push(id);
  const query = `UPDATE profiles SET ${setClause.join(', ')} WHERE id = $${index} RETURNING *`;

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function listProfiles(limit: number = 10, offset: number = 0): Promise<Profile[]> {
  const result = await pool.query(
    `SELECT * FROM profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}
