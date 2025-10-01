import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, CheckCircle2 } from "lucide-react";
import logo from "@/assets/hasapakia-logo.png";
import backgroundImage from "@/assets/supplier-bg.jpg";

interface FormData {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  about: string;
  categories: string[];
  activityAreas: string[];
  website: string;
  instagram: string;
  mainAddress: string;
  logo: File | null;
  productImages: File | null;
}

const categories = [
  "חומרי גלם יבשים",
  "ירקות, ירוקים, פירות",
  "בשר, עוף, דגים",
  "גבינות וחלב",
  "משקאות, מיצים, שייקים",
  "קפה ותה",
  "אלכוהול, יין, בירות",
  "קונדיטוריה, אפייה, גלידה",
  "לחמים ומאפים",
  "מתוקים וקינוחים",
  "מוצרי מעדניה",
  "אוכל מוכן וקייטרינג",
  "כלי אריזה וחומרי ניקוי",
  "ציוד מטבח ובר",
  "כלי בית",
  "אחר",
];

const activityAreas = ["צפון", "מרכז", "דרום", "שפלה", "כל הארץ"];

export default function SupplierRegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    contactName: "",
    phone: "",
    email: "",
    about: "",
    categories: [],
    activityAreas: [],
    website: "",
    instagram: "",
    mainAddress: "",
    logo: null,
    productImages: null,
  });

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [productImagesPreview, setProductImagesPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = "שדה חובה";
    }
    if (!formData.contactName.trim()) {
      newErrors.contactName = "שדה חובה";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "שדה חובה";
    }
    if (!formData.email.trim()) {
      newErrors.email = "שדה חובה";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "כתובת אימייל לא תקינה";
    }
    if (!formData.about.trim()) {
      newErrors.about = "שדה חובה";
    }
    if (!formData.mainAddress.trim()) {
      newErrors.mainAddress = "שדה חובה";
    }
    if (formData.categories.length === 0) {
      newErrors.categories = "יש לבחור לפחות קטגוריה אחת";
    }
    if (formData.activityAreas.length === 0) {
      newErrors.activityAreas = "יש לבחור לפחות איזור פעילות אחד";
    }

    if (formData.logo && formData.logo.size > 10 * 1024 * 1024) {
      newErrors.logo = "גודל הקובץ חורג מ-10MB";
    }
    if (formData.productImages && formData.productImages.size > 10 * 1024 * 1024) {
      newErrors.productImages = "גודל הקובץ חורג מ-10MB";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Prepare file data as base64
      let logoFileData = null;
      let logoFileName = null;
      if (formData.logo) {
        logoFileData = logoPreview;
        logoFileName = formData.logo.name;
      }

      let productImagesFileData = null;
      let productImagesFileName = null;
      if (formData.productImages) {
        productImagesFileData = productImagesPreview;
        productImagesFileName = formData.productImages.name;
      }

      // Call the edge function
      const response = await fetch(
        "https://rcvfgxtifjhfzdgodiel.supabase.co/functions/v1/submit-supplier",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessName: formData.businessName,
            contactName: formData.contactName,
            phone: formData.phone,
            email: formData.email,
            about: formData.about,
            categories: formData.categories,
            activityAreas: formData.activityAreas,
            website: formData.website,
            instagram: formData.instagram,
            mainAddress: formData.mainAddress,
            logoFile: logoFileData,
            logoFileName: logoFileName,
            productImagesFile: productImagesFileData,
            productImagesFileName: productImagesFileName,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setErrors({ submit: "שגיאה בשליחת הטופס. אנא נסה שוב." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleActivityAreaChange = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      activityAreas: prev.activityAreas.includes(area)
        ? prev.activityAreas.filter((a) => a !== area)
        : [...prev.activityAreas, area],
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: "logo" | "productImages") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData((prev) => ({
        ...prev,
        [field]: file,
      }));
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        if (field === "logo") {
          setLogoPreview(reader.result as string);
        } else {
          setProductImagesPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen relative py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Image with Blur and Fade */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(8px)',
            opacity: 0.15,
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-0 gradient-subtle opacity-90" />
        
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="bg-card rounded-2xl shadow-elegant p-8 sm:p-12 text-center">
            <div className="mb-6 flex justify-center">
              <CheckCircle2 className="w-20 h-20 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">תודה על ההרשמה!</h2>
            <p className="text-xl text-muted-foreground mb-6">
              הפרטים שלכם נקלטו בהצלחה במערכת
            </p>
            <p className="text-lg text-muted-foreground mb-8">
              אימייל אישור נשלח אליכם ואלינו
            </p>
            <div className="bg-secondary/50 rounded-xl p-6 border border-border">
              <p className="text-foreground font-medium">
                נבדוק את הפרטים ונחזור אליכם בהקדם. העסק שלכם יופיע באתר תוך 2-3 ימי עסקים
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Image with Blur and Fade */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'blur(8px)',
          opacity: 0.15,
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-0 gradient-subtle opacity-90" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="mb-8 flex justify-start">
          <img src={logo} alt="הספקיה" className="h-36" />
        </div>

        <div className="bg-card rounded-2xl shadow-elegant p-8 sm:p-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-6">
              ברוכים הבאים לאתר הספקיה
            </h1>
            <div className="space-y-4 text-lg text-muted-foreground max-w-3xl mx-auto text-right">
  <p>האתר היחיד שניתן למצוא בו את כל ספקי המזון והמשקאות בארץ.</p>
  <p>האתר שבו כל הלקוחות הפוטנציאלים שלכם יוכלו למצוא אתכם וליצור קשר בקלות ובמהירות</p>
  <p className="font-semibold text-primary text-xl">רוצים להצטרף ולהופיע באתר??</p>
  <p>כל שעליכם לעשות הוא למלא מספר פרטים בסיסיים וזהו.</p>
</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-lg">
                שם העסק <span className="text-destructive">*</span>
              </Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="text-lg h-12"
              />
              {errors.businessName && (
                <p className="text-destructive text-sm">{errors.businessName}</p>
              )}
            </div>

            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contactName" className="text-lg">
                שם איש קשר <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="text-lg h-12"
              />
              {errors.contactName && (
                <p className="text-destructive text-sm">{errors.contactName}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-lg">
                טלפון <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="text-lg h-12"
              />
              {errors.phone && <p className="text-destructive text-sm">{errors.phone}</p>}
            </div>

            {/* Main Address */}
            <div className="space-y-2">
              <Label htmlFor="mainAddress" className="text-lg">
                כתובת מרכזית <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mainAddress"
                type="text"
                value={formData.mainAddress}
                onChange={(e) => setFormData({ ...formData, mainAddress: e.target.value })}
                className="text-lg h-12"
              />
              {errors.mainAddress && (
                <p className="text-destructive text-sm">{errors.mainAddress}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-lg">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="text-lg h-12"
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
            </div>

            {/* About */}
            <div className="space-y-2">
              <Label htmlFor="about" className="text-lg">
                אודות העסק <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="about"
                value={formData.about}
                onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                placeholder="מה העסק מספק, כמה שנות פעילות, מי הלקוחות שלכם, מה החוזקות שלכם וכו'"
                className="min-h-32 text-lg"
              />
              {errors.about && <p className="text-destructive text-sm">{errors.about}</p>}
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <Label className="text-lg">
                קטגוריה <span className="text-destructive">*</span>
                <span className="text-sm text-muted-foreground mr-2">(ניתן לבחור יותר מאחת)</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map((category) => (
                  <div key={category} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`category-${category}`}
                      checked={formData.categories.includes(category)}
                      onCheckedChange={() => handleCategoryChange(category)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <label
                      htmlFor={`category-${category}`}
                      className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
              {errors.categories && (
                <p className="text-destructive text-sm">{errors.categories}</p>
              )}
            </div>

            {/* Activity Areas */}
            <div className="space-y-4">
              <Label className="text-lg">
                איזור פעילות <span className="text-destructive">*</span>
                <span className="text-sm text-muted-foreground mr-2">(ניתן לבחור יותר מאחד)</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {activityAreas.map((area) => (
                  <div key={area} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`area-${area}`}
                      checked={formData.activityAreas.includes(area)}
                      onCheckedChange={() => handleActivityAreaChange(area)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <label
                      htmlFor={`area-${area}`}
                      className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {area}
                    </label>
                  </div>
                ))}
              </div>
              {errors.activityAreas && (
                <p className="text-destructive text-sm">{errors.activityAreas}</p>
              )}
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website" className="text-lg">
                אתר אינטרנט
              </Label>
              <Input
                id="website"
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="www.example.com"
                className="text-lg h-12"
              />
            </div>

            {/* Instagram */}
            <div className="space-y-2">
              <Label htmlFor="instagram" className="text-lg">
                Instagram
              </Label>
              <Input
                id="instagram"
                value={formData.instagram}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                placeholder="@username"
                className="text-lg h-12"
              />
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label htmlFor="logo" className="text-lg">
                הוספת לוגו
              </Label>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-smooth cursor-pointer bg-muted/30">
                <input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "logo")}
                  className="hidden"
                />
                <label htmlFor="logo" className="cursor-pointer">
                  {logoPreview ? (
                    <div className="space-y-4">
                      <img src={logoPreview} alt="Logo preview" className="mx-auto max-h-48 rounded-lg" />
                      <p className="text-base text-muted-foreground">{formData.logo?.name}</p>
                      <p className="text-sm text-primary">לחץ להחלפת התמונה</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-base text-muted-foreground mb-2">
                        לחץ להעלאת קובץ או גרור לכאן
                      </p>
                      <p className="text-sm text-muted-foreground">מקסימום 10MB</p>
                    </>
                  )}
                </label>
              </div>
              {errors.logo && <p className="text-destructive text-sm">{errors.logo}</p>}
            </div>

            {/* Product Images Upload */}
            <div className="space-y-2">
              <Label htmlFor="productImages" className="text-lg">
                הוספת תמונות המוצרים
              </Label>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-smooth cursor-pointer bg-muted/30">
                <input
                  id="productImages"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "productImages")}
                  className="hidden"
                />
                <label htmlFor="productImages" className="cursor-pointer">
                  {productImagesPreview ? (
                    <div className="space-y-4">
                      <img src={productImagesPreview} alt="Product images preview" className="mx-auto max-h-48 rounded-lg" />
                      <p className="text-base text-muted-foreground">{formData.productImages?.name}</p>
                      <p className="text-sm text-primary">לחץ להחלפת התמונה</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-base text-muted-foreground mb-2">
                        לחץ להעלאת קובץ או גרור לכאן
                      </p>
                      <p className="text-sm text-muted-foreground">מקסימום 10MB</p>
                    </>
                  )}
                </label>
              </div>
              {errors.productImages && (
                <p className="text-destructive text-sm">{errors.productImages}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-6 space-y-4">
              {errors.submit && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-center">
                  <p className="text-destructive font-medium">{errors.submit}</p>
                </div>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 text-xl font-bold gradient-primary hover:shadow-glow transition-smooth disabled:opacity-50"
              >
                {isSubmitting ? "שולח..." : "שליחת הטופס והצטרפות לאתר"}
              </Button>
            </div>

            {/* Footer Note */}
            <div className="text-center pt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                לאחר השליחה יישלח אימייל אישור אליכם ואלינו
              </p>
              <p className="text-sm text-muted-foreground">נחזור אליכם בהקדם האפשרי</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
