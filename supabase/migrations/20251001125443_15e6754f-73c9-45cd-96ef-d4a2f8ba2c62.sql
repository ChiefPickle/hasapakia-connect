-- Add company_id column to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS company_id TEXT;