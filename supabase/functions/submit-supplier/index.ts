import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://esm.sh/zod@3.22.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Rate limiting store (in-memory, resets on function restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Validation schema
const supplierSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(200, "Business name too long"),
  contactName: z.string().trim().min(1, "Contact name is required").max(100, "Contact name too long"),
  phone: z.string().trim().min(1, "Phone is required").max(20, "Phone number too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  about: z.string().trim().min(1, "About section is required").max(2000, "About section too long"),
  categories: z.array(z.string()).min(1, "At least one category required").max(20, "Too many categories"),
  activityAreas: z.array(z.string()).min(1, "At least one activity area required").max(20, "Too many activity areas"),
  website: z.string().trim().max(500, "Website URL too long").optional().or(z.literal("")),
  instagram: z.string().trim().max(500, "Instagram URL too long").optional().or(z.literal("")),
  mainAddress: z.string().trim().min(1, "Main address is required").max(500, "Main address text too long"),
  logoFile: z.string().optional(),
  logoFileName: z.string().optional(),
  productImagesFile: z.string().optional(),
  productImagesFileName: z.string().optional(),
  productCatalogText: z.string().trim().max(5000, "Product catalog text too long").optional().or(z.literal("")),
  productCatalogFile: z.string().optional(),
  productCatalogFileName: z.string().optional(),
});

// Allowed MIME types for images
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Rate limiting check (3 submissions per IP per hour)
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 3600000 }); // 1 hour
    return true;
  }
  
  if (entry.count >= 3) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Validate file MIME type from base64 data
function validateFileMimeType(base64Data: string): { valid: boolean; mimeType: string | null } {
  try {
    const matches = base64Data.match(/^data:([^;]+);base64,/);
    if (!matches) return { valid: false, mimeType: null };
    
    const mimeType = matches[1];
    return {
      valid: ALLOWED_MIME_TYPES.includes(mimeType),
      mimeType
    };
  } catch {
    return { valid: false, mimeType: null };
  }
}

// Validate file size from base64 data
function validateFileSize(base64Data: string): boolean {
  try {
    const base64Content = base64Data.split(',')[1];
    const sizeInBytes = (base64Content.length * 3) / 4;
    return sizeInBytes <= MAX_FILE_SIZE;
  } catch {
    return false;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};


const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (!checkRateLimit(ip)) {
      console.log("Rate limit exceeded for IP:", ip);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Too many submissions. Please try again later." 
        }),
        {
          status: 429,
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders 
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const rawData = await req.json();
    
    // Validate input with Zod
    const validationResult = supplierSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.log("Validation failed:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid input data",
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders 
          },
        }
      );
    }

    const formData = validationResult.data;
    console.log("Received form submission for:", formData.businessName);

    let logoUrl = null;
    let productImagesUrl = null;

    // Upload logo if provided
    if (formData.logoFile && formData.logoFileName) {
      console.log("Uploading logo:", formData.logoFileName);
      
      // Validate file size
      if (!validateFileSize(formData.logoFile)) {
        throw new Error("Logo file size exceeds 5MB limit");
      }
      
      // Validate MIME type
      const { valid: validMime, mimeType } = validateFileMimeType(formData.logoFile);
      if (!validMime) {
        throw new Error(`Invalid logo file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`);
      }
      
      const logoBuffer = Uint8Array.from(atob(formData.logoFile.split(',')[1]), c => c.charCodeAt(0));
      // Sanitize filename: remove special characters
      const sanitizedFileName = formData.logoFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const logoPath = `${Date.now()}-${sanitizedFileName}`;
      
      const { data: logoData, error: logoError } = await supabase.storage
        .from("supplier-logos")
        .upload(logoPath, logoBuffer, {
          contentType: mimeType || "image/jpeg",
          upsert: false
        });

      if (logoError) {
        console.error("Logo upload error:", logoError);
        throw new Error(`Logo upload failed: ${logoError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("supplier-logos")
        .getPublicUrl(logoPath);
      
      logoUrl = publicUrl;
      console.log("Logo uploaded successfully:", logoUrl);
    }

    // Upload product images if provided
    if (formData.productImagesFile && formData.productImagesFileName) {
      console.log("Uploading product images:", formData.productImagesFileName);
      
      // Validate file size
      if (!validateFileSize(formData.productImagesFile)) {
        throw new Error("Product images file size exceeds 5MB limit");
      }
      
      // Validate MIME type
      const { valid: validMime, mimeType } = validateFileMimeType(formData.productImagesFile);
      if (!validMime) {
        throw new Error(`Invalid product images file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`);
      }
      
      const imagesBuffer = Uint8Array.from(atob(formData.productImagesFile.split(',')[1]), c => c.charCodeAt(0));
      // Sanitize filename: remove special characters
      const sanitizedFileName = formData.productImagesFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const imagesPath = `${Date.now()}-${sanitizedFileName}`;
      
      const { data: imagesData, error: imagesError } = await supabase.storage
        .from("supplier-products")
        .upload(imagesPath, imagesBuffer, {
          contentType: mimeType || "image/jpeg",
          upsert: false
        });

      if (imagesError) {
        console.error("Product images upload error:", imagesError);
        throw new Error(`Product images upload failed: ${imagesError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("supplier-products")
        .getPublicUrl(imagesPath);
      
      productImagesUrl = publicUrl;
      console.log("Product images uploaded successfully:", productImagesUrl);
    }

    // Insert supplier data into database
    const { data: supplierData, error: dbError } = await supabase
      .from("suppliers")
      .insert({
        business_name: formData.businessName,
        contact_name: formData.contactName,
        phone: formData.phone,
        email: formData.email,
        about: formData.about,
        categories: formData.categories,
        activity_areas: formData.activityAreas,
        website: formData.website || null,
        instagram: formData.instagram || null,
        main_address: formData.mainAddress || null,
        logo_url: logoUrl,
        product_images_url: productImagesUrl,
        status: "pending"
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    console.log("Supplier saved to database:", supplierData.id);

    // Send email notification with HTML escaping to prevent XSS
    const emailHtml = `
      <h1>ספק חדש נרשם להספקיה</h1>
      <h2>פרטי העסק:</h2>
      <ul>
        <li><strong>שם העסק:</strong> ${escapeHtml(formData.businessName)}</li>
        <li><strong>שם איש קשר:</strong> ${escapeHtml(formData.contactName)}</li>
        <li><strong>טלפון:</strong> ${escapeHtml(formData.phone)}</li>
        <li><strong>אימייל:</strong> ${escapeHtml(formData.email)}</li>
        <li><strong>קטגוריות:</strong> ${formData.categories.map(c => escapeHtml(c)).join(", ")}</li>
        <li><strong>אזורי פעילות:</strong> ${formData.activityAreas.map(a => escapeHtml(a)).join(", ")}</li>
        ${formData.website ? `<li><strong>אתר:</strong> ${escapeHtml(formData.website)}</li>` : ""}
        ${formData.instagram ? `<li><strong>אינסטגרם:</strong> ${escapeHtml(formData.instagram)}</li>` : ""}
        ${formData.mainAddress ? `<li><strong>כתובת מרכזית:</strong> ${escapeHtml(formData.mainAddress)}</li>` : ""}
      </ul>
      <h2>אודות העסק:</h2>
      <p>${escapeHtml(formData.about)}</p>
      ${logoUrl ? `<p><strong>לוגו:</strong> <a href="${escapeHtml(logoUrl)}">צפה בלוגו</a></p>` : ""}
      ${productImagesUrl ? `<p><strong>תמונות מוצרים:</strong> <a href="${escapeHtml(productImagesUrl)}">צפה בתמונות</a></p>` : ""}
    `;

    const { error: emailError } = await resend.emails.send({
      from: "Hasapakia <onboarding@resend.dev>",
      to: ["ychelly.work@gmail.com", "yakir.rotem@gmail.com", "doron.d.sahar@gmail.com"],
      subject: `ספק חדש נרשם - ${escapeHtml(formData.businessName)}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email error:", emailError);
      // Don't fail the whole request if email fails
    } else {
      console.log("Email sent successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Supplier registered successfully",
        supplierId: supplierData.id 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in submit-supplier function:", error);
    // Don't expose internal error details to users
    const userMessage = error.message?.includes("file") || 
                       error.message?.includes("Invalid") || 
                       error.message?.includes("limit") ||
                       error.message?.includes("Too many")
      ? error.message 
      : "An error occurred while processing your request";
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: userMessage
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
