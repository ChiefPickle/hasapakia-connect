-- Add Google Drive link field to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS product_catalog_drive_link text;