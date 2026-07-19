-- Enums
CREATE TYPE role AS ENUM ('user', 'admin');
CREATE TYPE posting_status AS ENUM ('active', 'stale', 'archived');
CREATE TYPE match_result AS ENUM ('apply', 'maybe', 'skip');
CREATE TYPE application_status AS ENUM (
  'matched', 'drafted', 'reviewed', 'submitted',
  'response_received', 'interview', 'offer', 'rejected'
);

-- Extension needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role role NOT NULL DEFAULT 'user',
  verification_token TEXT,
verification_token_expires_at TIMESTAMP,
email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- refresh_tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
-- profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  resume_url TEXT,
  raw_resume_text TEXT,
  parsed_data JSONB,
  parser_version VARCHAR,
  field_confidence JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- postings
CREATE TABLE postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR NOT NULL,
  external_id VARCHAR NOT NULL,
  company VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  location TEXT,
  employment_type VARCHAR,
  remote BOOLEAN,
  raw_description TEXT,
  source_url TEXT,
  status posting_status NOT NULL DEFAULT 'active',
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_postings_status ON postings(status);

-- requirements
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id UUID UNIQUE NOT NULL REFERENCES postings(id),
  structured_data JSONB,
  parser_version VARCHAR,
  confidence_score JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
-- matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  posting_id UUID NOT NULL REFERENCES postings(id),
  match_score DECIMAL(5,2),
  match_result match_result NOT NULL,
  reasoning TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (user_id, posting_id)
);

CREATE INDEX idx_matches_user_id ON matches(user_id);
CREATE INDEX idx_matches_posting_id ON matches(posting_id);
CREATE INDEX idx_matches_created_at ON matches(created_at);

-- applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID UNIQUE NOT NULL REFERENCES matches(id),
  drafted_fields JSONB,
  status application_status NOT NULL DEFAULT 'matched',
  submitted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_status ON applications(status);

-- stage_history
CREATE TABLE stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  from_status VARCHAR,
  to_status VARCHAR,
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_stage_history_application_id ON stage_history(application_id);

-- otp_codes (for email verification)
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);