-- Create table for demo access requests
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS demo_requests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_demo_requests_email ON demo_requests(email);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);

-- Enable Row Level Security
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert demo requests (public form submission)
CREATE POLICY "Anyone can submit demo requests"
  ON demo_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create policy to allow authenticated users to read demo requests (for admin dashboard)
CREATE POLICY "Authenticated users can view demo requests"
  ON demo_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow authenticated users to update demo requests (for status changes)
CREATE POLICY "Authenticated users can update demo requests"
  ON demo_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verify table creation
SELECT 
  'demo_requests table created successfully!' as message,
  COUNT(*) as total_requests
FROM demo_requests;

