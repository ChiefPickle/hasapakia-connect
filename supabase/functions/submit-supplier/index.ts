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
  companyId: z.string().trim().max(50, "Company ID too long").optional().or(z.literal("")),
  contactName: z.string().trim().min(1, "Contact name is required").max(100, "Contact name too long"),
  phone: z.string().trim().min(1, "Phone is required").max(20, "Phone number too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  about: z.string().trim().min(1, "About section is required").max(2000, "About section too long"),
  categories: z.array(z.string()).min(1, "At least one category required").max(20, "Too many categories"),
  activityAreas: z.array(z.string()).min(1, "At least one activity area required").max(20, "Too many activity areas"),
  website: z.string().trim().max(500, "Website URL too long").optional().or(z.literal("")),
  instagram: z.string().trim().max(500, "Instagram URL too long").optional().or(z.literal("")),
  mainAddress: z.string().trim().min(1, "Main address is required").max(500, "Main address text too long"),
  logoFile: z.string().nullable().optional(),
  logoFileName: z.string().nullable().optional(),
  productImagesFiles: z.array(z.string()).optional().default([]),
  productImagesFileNames: z.array(z.string()).optional().default([]),
  productCatalogType: z.enum(["text", "file", "drive", ""]).optional(),
  productCatalogText: z.string().trim().max(5000, "Product catalog text too long").optional().or(z.literal("")),
  productCatalogFile: z.string().nullable().optional(),
  productCatalogFileName: z.string().nullable().optional(),
  productCatalogDriveLink: z.string().trim().max(1000, "Drive link too long").optional().or(z.literal("")),
});

// Hebrew field name mapping for error messages
const fieldNameMapping: Record<string, string> = {
  businessName: "שם העסק",
  companyId: "ח.פ / ע.מ",
  contactName: "שם איש קשר",
  phone: "טלפון",
  email: "אימייל",
  about: "אודות העסק",
  categories: "קטגוריות",
  activityAreas: "אזורי פעילות",
  website: "אתר",
  instagram: "אינסטגרם",
  mainAddress: "כתובת מרכזית",
  logoFile: "קובץ לוגו",
  logoFileName: "שם קובץ לוגו",
  productImagesFiles: "קבצי תמונות מוצרים",
  productImagesFileNames: "שמות קבצי תמונות",
  productCatalogText: "תיאור מוצרים",
  productCatalogFile: "קובץ קטלוג",
  productCatalogFileName: "שם קובץ קטלוג",
  productCatalogDriveLink: "קישור Drive",
  productCatalogType: "סוג קטלוג"
};

// Allowed MIME types for images and PDFs
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const ALLOWED_CATALOG_TYPES = [...ALLOWED_MIME_TYPES, "application/pdf"];
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
function validateFileMimeType(base64Data: string, allowedTypes: string[] = ALLOWED_MIME_TYPES): { valid: boolean; mimeType: string | null } {
  try {
    const matches = base64Data.match(/^data:([^;]+);base64,/);
    if (!matches) return { valid: false, mimeType: null };
    
    const mimeType = matches[1];
    return {
      valid: allowedTypes.includes(mimeType),
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
          error: "נתונים לא תקינים",
          details: validationResult.error.errors.map(e => {
            const fieldPath = e.path.join('.');
            const hebrewField = fieldNameMapping[fieldPath] || fieldPath;
            return `${hebrewField}: ${e.message}`;
          }),
          fields: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            hebrewName: fieldNameMapping[e.path.join('.')] || e.path.join('.'),
            message: e.message
          }))
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
    const productImageUrls: string[] = [];
    let productCatalogUrl = null;

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
    if (formData.productImagesFiles && formData.productImagesFiles.length > 0) {
      console.log(`Uploading ${formData.productImagesFiles.length} product images`);
      
      for (let i = 0; i < formData.productImagesFiles.length; i++) {
        const imageFile = formData.productImagesFiles[i];
        const imageFileName = formData.productImagesFileNames?.[i] || `image-${i}.jpg`;
        
        // Validate file size
        if (!validateFileSize(imageFile)) {
          throw new Error(`Product image ${i + 1} exceeds 5MB limit`);
        }
        
        // Validate MIME type
        const { valid: validMime, mimeType } = validateFileMimeType(imageFile);
        if (!validMime) {
          throw new Error(`Invalid file type for product image ${i + 1}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
        }
        
        const imagesBuffer = Uint8Array.from(atob(imageFile.split(',')[1]), c => c.charCodeAt(0));
        const sanitizedFileName = imageFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const imagesPath = `${Date.now()}-${i}-${sanitizedFileName}`;
        
        const { error: imagesError } = await supabase.storage
          .from("supplier-products")
          .upload(imagesPath, imagesBuffer, {
            contentType: mimeType || "image/jpeg",
            upsert: false
          });
    
        if (imagesError) {
          console.error(`Product image ${i + 1} upload error:`, imagesError);
          throw new Error(`Product image ${i + 1} upload failed: ${imagesError.message}`);
        }
    
        const { data: { publicUrl } } = supabase.storage
          .from("supplier-products")
          .getPublicUrl(imagesPath);
        
        productImageUrls.push(publicUrl);
        console.log(`Product image ${i + 1} uploaded:`, publicUrl);
      }
    }

    // Upload product catalog if provided
    if (formData.productCatalogFile && formData.productCatalogFileName) {
      console.log("Uploading product catalog:", formData.productCatalogFileName);
      
      // Validate file size
      if (!validateFileSize(formData.productCatalogFile)) {
        throw new Error("Product catalog file size exceeds 5MB limit");
      }
      
      // Validate MIME type (allow PDFs and images)
      const { valid: validMime, mimeType } = validateFileMimeType(formData.productCatalogFile, ALLOWED_CATALOG_TYPES);
      if (!validMime) {
        throw new Error(`Invalid catalog file type. Allowed types: ${ALLOWED_CATALOG_TYPES.join(", ")}`);
      }
      
      const catalogBuffer = Uint8Array.from(atob(formData.productCatalogFile.split(',')[1]), c => c.charCodeAt(0));
      // Sanitize filename: remove special characters
      const sanitizedFileName = formData.productCatalogFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const catalogPath = `${Date.now()}-${sanitizedFileName}`;
      
      const { data: catalogData, error: catalogError } = await supabase.storage
        .from("supplier-products")
        .upload(catalogPath, catalogBuffer, {
          contentType: mimeType || "application/pdf",
          upsert: false
        });

      if (catalogError) {
        console.error("Product catalog upload error:", catalogError);
        throw new Error(`Product catalog upload failed: ${catalogError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("supplier-products")
        .getPublicUrl(catalogPath);
      
      productCatalogUrl = publicUrl;
      console.log("Product catalog uploaded successfully:", productCatalogUrl);
    }

    // Insert supplier data into database
    const { data: supplierData, error: dbError } = await supabase
      .from("suppliers")
      .insert({
        business_name: formData.businessName,
        company_id: formData.companyId || null,
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
        product_images_url: productImageUrls.length > 0 ? productImageUrls : null,
        product_catalog_text: formData.productCatalogText || null,
        product_catalog_url: productCatalogUrl,
        product_catalog_drive_link: formData.productCatalogDriveLink || null,
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
      ${formData.productCatalogText ? `<h2>תיאור מוצרים:</h2><p>${escapeHtml(formData.productCatalogText)}</p>` : ""}
      ${logoUrl ? `<p><strong>לוגו:</strong> <a href="${escapeHtml(logoUrl)}">צפה בלוגו</a></p>` : ""}
      ${productImageUrls.length > 0 ? `
        <p><strong>תמונות מוצרים:</strong></p>
        <ul>
          ${productImageUrls.map((url, idx) => `<li><a href="${escapeHtml(url)}">תמונה ${idx + 1}</a></li>`).join('')}
        </ul>
      ` : ""}
      ${productCatalogUrl ? `<p><strong>קטלוג מוצרים (קובץ):</strong> <a href="${escapeHtml(productCatalogUrl)}">צפה בקטלוג</a></p>` : ""}
      ${formData.productCatalogDriveLink ? `<p><strong>קטלוג מוצרים (Google Drive):</strong> <a href="${escapeHtml(formData.productCatalogDriveLink)}">${escapeHtml(formData.productCatalogDriveLink)}</a></p>` : ""}
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

    // Send confirmation email to customer
    console.log("Sending confirmation email to customer:", formData.email);

    const customerEmailHtml = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a472a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #1a472a; }
          .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
          h1 { margin: 0; font-size: 24px; }
          h2 { color: #1a472a; font-size: 20px; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 הטופס נקלט בהצלחה!</h1>
          </div>
          <div class="content">
            <div class="success-icon">✅</div>
            
            <h2>שלום ${escapeHtml(formData.contactName)},</h2>
            
            <p>תודה רבה על ההרשמה למאגר הספקים של Hasapakia!</p>
            
            <div class="info-box">
              <p><strong>קיבלנו את הפרטים שלך:</strong></p>
              <ul style="list-style: none; padding: 0;">
                <li>📌 עסק: ${escapeHtml(formData.businessName)}</li>
                <li>👤 איש קשר: ${escapeHtml(formData.contactName)}</li>
                <li>📧 אימייל: ${escapeHtml(formData.email)}</li>
                <li>📱 טלפון: ${escapeHtml(formData.phone)}</li>
              </ul>
            </div>
            
            <p><strong>מה קורה עכשיו?</strong></p>
            <ol>
              <li>הצוות שלנו בוחן את הפרטים שהגשת</li>
              <li>אנחנו עשויים לחזור אליך עם שאלות נוספות</li>
              <li>ברגע שהספק יאושר, תקבל הודעה נוספת</li>
            </ol>
            
            <p>אם יש לך שאלות, אל תהסס לפנות אלינו.</p>
            
            <div class="footer">
              <p>Hasapakia - המקום שבו קולינריה פוגשת איכות</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const { error: customerEmailError } = await resend.emails.send({
      from: "Hasapakia <onboarding@resend.dev>",
      to: [formData.email],
      subject: "✅ הטופס שלך נקלט בהצלחה - Hasapakia",
      html: customerEmailHtml,
    });

    if (customerEmailError) {
      console.error("Error sending confirmation email to customer:", customerEmailError);
      // Don't throw error - admin email was sent successfully
    } else {
      console.log("Confirmation email sent successfully to customer");
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
