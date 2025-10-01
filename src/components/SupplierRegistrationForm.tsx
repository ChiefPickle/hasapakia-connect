import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { FileUploadZone } from "@/components/ui/file-upload-zone";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import logo from "@/assets/hasapakia-logo.png";
import backgroundImage from "@/assets/supplier-bg.jpg";
interface FormData {
  businessName: string;
  companyId: string;
  contactName: string;
  phone: string;
  email: string;
  about: string;
  categories: string[];
  activityAreas: string[];
  website: string;
  instagram: string;
  mainAddress: string;
  logo: FileList | null;
  productImages: FileList | null;
  productCatalogType: "text" | "file" | "drive" | "";
  productCatalogText: string;
  productCatalogFile: FileList | null;
  productCatalogDriveLink: string;
}
const categories = ["חומרי גלם יבשים", "ירקות, ירוקים, פירות", "בשר, עוף, דגים", "גבינות וחלב", "משקאות, מיצים, שייקים", "קפה ותה", "אלכוהול, יין, בירות", "קונדיטוריה, אפייה, גלידה", "לחמים ומאפים", "מתוקים וקינוחים", "מוצרי מעדניה", "אוכל מוכן וקייטרינג", "כלי אריזה וחומרי ניקוי", "ציוד מטבח ובר", "כלי בית", "אחר"];
const activityAreas = ["צפון", "מרכז", "דרום", "שפלה", "כל הארץ"];
export default function SupplierRegistrationForm() {
  const {
    toast
  } = useToast();
  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    companyId: "",
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
    productCatalogType: "",
    productCatalogText: "",
    productCatalogFile: null,
    productCatalogDriveLink: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [productImagesPreview, setProductImagesPreview] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otherCategory, setOtherCategory] = useState<string>("");
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.businessName.trim()) newErrors.businessName = "שדה חובה";
    if (!formData.contactName.trim()) newErrors.contactName = "שדה חובה";
    if (!formData.phone.trim()) newErrors.phone = "שדה חובה";
    if (!formData.email.trim()) {
      newErrors.email = "שדה חובה";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "כתובת אימייל לא תקינה";
    }
    if (!formData.about.trim()) newErrors.about = "שדה חובה";
    if (!formData.mainAddress.trim()) newErrors.mainAddress = "שדה חובה";
    if (formData.categories.length === 0) newErrors.categories = "יש לבחור לפחות קטגוריה אחת";
    if (formData.activityAreas.length === 0) newErrors.activityAreas = "יש לבחור לפחות איזור פעילות אחד";
    if (formData.logo && formData.logo[0] && formData.logo[0].size > 10 * 1024 * 1024) {
      newErrors.logo = "גודל הקובץ חורג מ-10MB";
    }
    if (formData.productImages && formData.productImages[0] && formData.productImages[0].size > 10 * 1024 * 1024) {
      newErrors.productImages = "גודל הקובץ חורג מ-10MB";
    }
    if (formData.productCatalogFile && formData.productCatalogFile[0] && formData.productCatalogFile[0].size > 10 * 1024 * 1024) {
      newErrors.productCatalogFile = "גודל הקובץ חורג מ-10MB";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({
        title: "שגיאה בטופס",
        description: "אנא מלא את כל השדות החובה",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    setErrors({});
    try {
      // Prepare file data as base64
      let logoFileData = null;
      let logoFileName = null;
      if (formData.logo && formData.logo[0]) {
        logoFileData = logoPreview;
        logoFileName = formData.logo[0].name;
      }
      let productImagesFileData = null;
      let productImagesFileName = null;
      if (formData.productImages && formData.productImages[0]) {
        productImagesFileData = productImagesPreview[0];
        productImagesFileName = formData.productImages[0].name;
      }
      let productCatalogFileData = null;
      let productCatalogFileName = null;
      if (formData.productCatalogFile && formData.productCatalogFile[0]) {
        const reader = new FileReader();
        const fileData = await new Promise<string>(resolve => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(formData.productCatalogFile![0]);
        });
        productCatalogFileData = fileData;
        productCatalogFileName = formData.productCatalogFile[0].name;
      }

      // Transform categories if "אחר" is selected with text
      let submittedCategories = formData.categories;
      if (formData.categories.includes("אחר") && otherCategory.trim()) {
        submittedCategories = formData.categories.map(cat => cat === "אחר" ? `אחר: ${otherCategory.trim()}` : cat);
      }

      // Call the edge function
      const response = await fetch("https://rcvfgxtifjhfzdgodiel.supabase.co/functions/v1/submit-supplier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          businessName: formData.businessName,
          companyId: formData.companyId,
          contactName: formData.contactName,
          phone: formData.phone,
          email: formData.email,
          about: formData.about,
          categories: submittedCategories,
          activityAreas: formData.activityAreas,
          website: formData.website,
          instagram: formData.instagram,
          mainAddress: formData.mainAddress,
          logoFile: logoFileData,
          logoFileName: logoFileName,
          productImagesFile: productImagesFileData,
          productImagesFileName: productImagesFileName,
          productCatalogType: formData.productCatalogType,
          productCatalogText: formData.productCatalogText,
          productCatalogFile: productCatalogFileData,
          productCatalogFileName: productCatalogFileName,
          productCatalogDriveLink: formData.productCatalogDriveLink
        })
      });
      const result = await response.json();
      if (result.success) {
        setSubmitted(true);
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      } else {
        throw new Error(result.error || "Submission failed");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "שגיאה",
        description: "שגיאה בשליחת הטופס. אנא נסה שוב.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleLogoChange = (files: FileList | null) => {
    setFormData(prev => ({
      ...prev,
      logo: files
    }));
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(files[0]);
    } else {
      setLogoPreview("");
    }
  };
  const handleProductImagesChange = (files: FileList | null) => {
    setFormData(prev => ({
      ...prev,
      productImages: files
    }));
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setProductImagesPreview([reader.result as string]);
      reader.readAsDataURL(files[0]);
    } else {
      setProductImagesPreview([]);
    }
  };
  if (submitted) {
    return <div className="min-h-screen relative py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 z-0" style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        filter: "blur(8px)",
        opacity: 0.15
      }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/90 to-background/70" />

        <div className="max-w-2xl mx-auto relative z-10">
          <Card className="border-2">
            <CardContent className="p-8 sm:p-12 text-center">
              <div className="mb-6 flex justify-center">
                <CheckCircle2 className="w-20 h-20 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">תודה על ההרשמה!</h2>
              <p className="text-xl text-muted-foreground mb-6">
                הפרטים שלכם נקלטו בהצלחה במערכת
              </p>
              <p className="text-lg text-muted-foreground mb-8">
                אימייל אישור נשלח אליכם ואלינו
              </p>
              <Card className="bg-secondary/50">
                <CardContent className="p-6">
                  <p className="font-medium">
                    נבדוק את הפרטים ונחזור אליכם בהקדם. העסק שלכם יופיע באתר תוך 2-3 ימי עסקים
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  return <div className="font-noto-hebrew min-h-screen relative py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 z-0" style={{
      backgroundImage: `url(${backgroundImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      filter: "blur(8px)",
      opacity: 0.15
    }} />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/90 to-background/70" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src={logo}
            alt="הספקיה"
            className="w-40 sm:w-48 md:w-56 h-auto drop-shadow-md"
          />
        </div>

        {/* Form Card */}
        <Card className="border-2">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-4xl font-bold mb-4">
              <div>ברוכים הבאים לאתר הַסַּפָּקִיָּה</div>
              <div className="font-bold mt-2">האתר הולך לעלות בזמן הקרוב</div>
            </CardTitle>
            <CardDescription className="text-base max-w-3xl mx-auto">
              <div className="space-y-3">
                <div>האתר היחיד שניתן למצוא בו את כל ספקי המזון והמשקאות בארץ.</div>
                <div>האתר שבו כל הלקוחות הפוטנציאלים שלכם יוכלו למצוא אתכם וליצור קשר בקלות ובמהירות</div>
                <div className="font-semibold text-primary text-lg">רוצים להצטרף ולהופיע באתר??</div>
                <div>כל שעליכם לעשות הוא למלא מספר פרטים בסיסיים וזהו.</div>
              </div>
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 sm:px-12 pb-12">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle>פרטים בסיסיים</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">
                        שם העסק <span className="text-destructive">*</span>
                      </Label>
                      <Input id="businessName" value={formData.businessName} onChange={e => setFormData({
                      ...formData,
                      businessName: e.target.value
                    })} />
                      {errors.businessName && <p className="text-destructive text-sm">{errors.businessName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyId">
                        ח.פ / ע.מ
                      </Label>
                      <Input id="companyId" value={formData.companyId} onChange={e => setFormData({
                      ...formData,
                      companyId: e.target.value
                    })} placeholder="הזן מספר ח.פ או ע.מ" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input id="email" type="email" value={formData.email} onChange={e => setFormData({
                      ...formData,
                      email: e.target.value
                    })} />
                      {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactName">
                        שם איש קשר <span className="text-destructive">*</span>
                      </Label>
                      <Input id="contactName" value={formData.contactName} onChange={e => setFormData({
                      ...formData,
                      contactName: e.target.value
                    })} />
                      {errors.contactName && <p className="text-destructive text-sm">{errors.contactName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        טלפון <span className="text-destructive">*</span>
                      </Label>
                      <Input id="phone" type="tel" value={formData.phone} onChange={e => setFormData({
                      ...formData,
                      phone: e.target.value
                    })} />
                      {errors.phone && <p className="text-destructive text-sm">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mainAddress">
                      כתובת מרכזית <span className="text-destructive">*</span>
                    </Label>
                    <Input id="mainAddress" value={formData.mainAddress} onChange={e => setFormData({
                    ...formData,
                    mainAddress: e.target.value
                  })} />
                    {errors.mainAddress && <p className="text-destructive text-sm">{errors.mainAddress}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="about">
                      אודות העסק <span className="text-destructive">*</span>
                    </Label>
                    <Textarea id="about" value={formData.about} onChange={e => setFormData({
                    ...formData,
                    about: e.target.value
                  })} placeholder="מה העסק מספק, כמה שנות פעילות, מי הלקוחות שלכם, מה החוזקות שלכם וכו'" className="min-h-24" />
                    {errors.about && <p className="text-destructive text-sm">{errors.about}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="website">אתר אינטרנט</Label>
                      <Input id="website" value={formData.website} onChange={e => setFormData({
                      ...formData,
                      website: e.target.value
                    })} placeholder="www.example.com" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input id="instagram" value={formData.instagram} onChange={e => setFormData({
                      ...formData,
                      instagram: e.target.value
                    })} placeholder="@username" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Categories & Location Card */}
              <Card>
                <CardHeader>
                  <CardTitle>קטגוריות ואיזורי פעילות</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>
                      קטגוריה <span className="text-destructive">*</span>
                    </Label>
                    <MultiSelect options={categories} selected={formData.categories} onChange={selected => setFormData({
                    ...formData,
                    categories: selected
                  })} placeholder="בחר קטגוריות..." />
                    {errors.categories && <p className="text-destructive text-sm">{errors.categories}</p>}
                    {formData.categories.includes("אחר") && <div className="mt-4">
                        <Label htmlFor="otherCategory">פרט את הקטגוריה</Label>
                        <Input id="otherCategory" value={otherCategory} onChange={e => setOtherCategory(e.target.value)} placeholder="הזן את שם הקטגוריה..." className="mt-2" />
                      </div>}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      איזור פעילות <span className="text-destructive">*</span>
                    </Label>
                    <MultiSelect options={activityAreas} selected={formData.activityAreas} onChange={selected => setFormData({
                    ...formData,
                    activityAreas: selected
                  })} placeholder="בחר איזורי פעילות..." />
                    {errors.activityAreas && <p className="text-destructive text-sm">{errors.activityAreas}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Media & Files Card */}
              <Card>
                <CardHeader>
                  <CardTitle>קבצים ומדיה (כמה שיותר מידע יותר חשיפה)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>הוספת לוגו</Label>
                    <FileUploadZone accept="image/*" value={formData.logo} onChange={handleLogoChange} preview={logoPreview} maxSize={10} />
                    {errors.logo && <p className="text-destructive text-sm">{errors.logo}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>תמונות</Label>
                    <FileUploadZone accept="image/*" value={formData.productImages} onChange={handleProductImagesChange} preview={productImagesPreview} maxSize={10} />
                    {errors.productImages && <p className="text-destructive text-sm">{errors.productImages}</p>}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Label>קטלוג מוצרים</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" type="button" className="h-5 w-5">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-80">
                          <div className="space-y-2 text-sm">
                            <p className="font-semibold">שיתוף קטלוג מ-Google Drive:</p>
                            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                              <li>פתח את הקובץ ב-Google Drive</li>
                              <li>לחץ על "שתף" או "Share"</li>
                              <li>בחר "כל מי שיש לו את הקישור"</li>
                              <li>העתק את הקישור והדבק כאן</li>
                            </ol>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <RadioGroup value={formData.productCatalogType} onValueChange={value => setFormData({
                    ...formData,
                    productCatalogType: value as "text" | "file" | "drive" | ""
                  })} className="space-y-4 text-right">
                      <div className="flex flex-row-reverse items-start gap-3">
                        <RadioGroupItem value="text" id="catalog-text" className="mt-1" />
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="catalog-text" className="cursor-pointer">
                            תיאור טקסטואלי
                          </Label>
                          {formData.productCatalogType === "text" && <Textarea value={formData.productCatalogText} onChange={e => setFormData({
                          ...formData,
                          productCatalogText: e.target.value
                        })} placeholder="תאר את המוצרים שלך..." className="min-h-24" />}
                        </div>
                      </div>

                      <div className="flex flex-row-reverse items-start gap-3">
                        <RadioGroupItem value="file" id="catalog-file" className="mt-1" />
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="catalog-file" className="cursor-pointer">
                            העלאת קובץ
                          </Label>
                          {formData.productCatalogType === "file" && <FileUploadZone accept=".pdf,.doc,.docx,.xls,.xlsx" value={formData.productCatalogFile} onChange={files => setFormData({
                          ...formData,
                          productCatalogFile: files
                        })} maxSize={10} />}
                        </div>
                      </div>

                      
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>

              {errors.submit && <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                  <p className="text-destructive text-center">{errors.submit}</p>
                </div>}

              <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-lg" size="lg">
                {isSubmitting ? "שולח..." : "שלח טופס"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>;
}