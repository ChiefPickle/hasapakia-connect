-- Add user_id column to suppliers table to link to authenticated users
ALTER TABLE public.suppliers 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update the INSERT policy to require authentication
DROP POLICY IF EXISTS "Anyone can insert suppliers" ON public.suppliers;

CREATE POLICY "Authenticated users can insert their own suppliers"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own submissions
CREATE POLICY "Users can view their own suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_suppliers_user_id ON public.suppliers(user_id);