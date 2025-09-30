import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SupplierFormData {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  about: string;
  categories: string[];
  activityAreas: string[];
  website?: string;
  instagram?: string;
  openHours?: string;
  deliveryRadius?: string;
  logoFile?: string; // base64 encoded
  logoFileName?: string;
  productImagesFile?: string; // base64 encoded
  productImagesFileName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData: SupplierFormData = await req.json();
    console.log("Received form submission for:", formData.businessName);

    let logoUrl = null;
    let productImagesUrl = null;

    // Upload logo if provided
    if (formData.logoFile && formData.logoFileName) {
      console.log("Uploading logo:", formData.logoFileName);
      const logoBuffer = Uint8Array.from(atob(formData.logoFile.split(',')[1]), c => c.charCodeAt(0));
      const logoPath = `${Date.now()}-${formData.logoFileName}`;
      
      const { data: logoData, error: logoError } = await supabase.storage
        .from("supplier-logos")
        .upload(logoPath, logoBuffer, {
          contentType: "image/*",
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
      const imagesBuffer = Uint8Array.from(atob(formData.productImagesFile.split(',')[1]), c => c.charCodeAt(0));
      const imagesPath = `${Date.now()}-${formData.productImagesFileName}`;
      
      const { data: imagesData, error: imagesError } = await supabase.storage
        .from("supplier-products")
        .upload(imagesPath, imagesBuffer, {
          contentType: "image/*",
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
        open_hours: formData.openHours || null,
        delivery_radius: formData.deliveryRadius || null,
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

    // Send email notification
    const emailHtml = `
      <h1>ספק חדש נרשם להספקיה</h1>
      <h2>פרטי העסק:</h2>
      <ul>
        <li><strong>שם העסק:</strong> ${formData.businessName}</li>
        <li><strong>שם איש קשר:</strong> ${formData.contactName}</li>
        <li><strong>טלפון:</strong> ${formData.phone}</li>
        <li><strong>אימייל:</strong> ${formData.email}</li>
        <li><strong>קטגוריות:</strong> ${formData.categories.join(", ")}</li>
        <li><strong>אזורי פעילות:</strong> ${formData.activityAreas.join(", ")}</li>
        ${formData.website ? `<li><strong>אתר:</strong> ${formData.website}</li>` : ""}
        ${formData.instagram ? `<li><strong>אינסטגרם:</strong> ${formData.instagram}</li>` : ""}
        ${formData.openHours ? `<li><strong>שעות פתיחה:</strong> ${formData.openHours}</li>` : ""}
        ${formData.deliveryRadius ? `<li><strong>רדיוס משלוח:</strong> ${formData.deliveryRadius}</li>` : ""}
      </ul>
      <h2>אודות העסק:</h2>
      <p>${formData.about}</p>
      ${logoUrl ? `<p><strong>לוגו:</strong> <a href="${logoUrl}">צפה בלוגו</a></p>` : ""}
      ${productImagesUrl ? `<p><strong>תמונות מוצרים:</strong> <a href="${productImagesUrl}">צפה בתמונות</a></p>` : ""}
    `;

    const { error: emailError } = await resend.emails.send({
      from: "Hasapakia <onboarding@resend.dev>",
      to: ["ychelly.work@gmail.com"],
      subject: `ספק חדש נרשם - ${formData.businessName}`,
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
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "An error occurred while processing your request" 
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
