CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_id text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  is_verified bool DEFAULT false,
  coins integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);