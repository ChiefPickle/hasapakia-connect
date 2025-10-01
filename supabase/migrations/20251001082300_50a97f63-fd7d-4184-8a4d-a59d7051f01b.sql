-- Add product catalog fields to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS product_catalog_text text,
ADD COLUMN IF NOT EXISTS product_catalog_url text;