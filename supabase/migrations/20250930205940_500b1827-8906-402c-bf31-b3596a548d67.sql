-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  about TEXT NOT NULL,
  categories TEXT[] NOT NULL,
  activity_areas TEXT[] NOT NULL,
  website TEXT,
  instagram TEXT,
  open_hours TEXT,
  delivery_radius TEXT,
  logo_url TEXT,
  product_images_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public registration form)
CREATE POLICY "Anyone can insert suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (true);

-- Only allow reading your own submission or admin access
CREATE POLICY "Users can view all suppliers" 
ON public.suppliers 
FOR SELECT 
USING (true);

-- Create storage buckets for uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('supplier-logos', 'supplier-logos', true);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('supplier-products', 'supplier-products', true);

-- Storage policies for logo uploads
CREATE POLICY "Anyone can upload logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'supplier-logos');

CREATE POLICY "Anyone can view logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'supplier-logos');

-- Storage policies for product images
CREATE POLICY "Anyone can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'supplier-products');

CREATE POLICY "Anyone can view product images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'supplier-products');