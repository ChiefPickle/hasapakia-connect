-- Change product_images_url to support multiple URLs (array type)
ALTER TABLE public.suppliers 
ALTER COLUMN product_images_url TYPE TEXT[] 
USING CASE 
  WHEN product_images_url IS NULL THEN NULL
  WHEN product_images_url = '' THEN NULL
  ELSE ARRAY[product_images_url]
END;

-- Add comment for clarity
COMMENT ON COLUMN public.suppliers.product_images_url IS 'Array of product image URLs';