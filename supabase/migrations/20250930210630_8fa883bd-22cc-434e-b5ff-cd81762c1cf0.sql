-- Remove the public SELECT policy that exposes all supplier data
DROP POLICY IF EXISTS "Users can view all suppliers" ON public.suppliers;

-- Create a more restrictive policy: only service role can access
-- This means data is only accessible through:
-- 1. Backend edge functions (which use service role key)
-- 2. Lovable Cloud dashboard (for admin access)
CREATE POLICY "Only service role can view suppliers" 
ON public.suppliers 
FOR SELECT 
TO service_role
USING (true);

-- Keep the public INSERT policy for registration form
-- This is safe because users can only add their own data, not read others'