-- Add main_address column to suppliers table
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS main_address text;

-- Drop old columns that are no longer needed
ALTER TABLE public.suppliers
DROP COLUMN IF EXISTS open_hours,
DROP COLUMN IF EXISTS delivery_radius;