import * as React from "react";
import { Upload, X, File, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
interface FileUploadZoneProps {
  accept?: string;
  multiple?: boolean;
  value: FileList | null;
  onChange: (files: FileList | null) => void;
  preview?: string | string[];
  maxSize?: number; // in MB
  className?: string;
}
export function FileUploadZone({
  accept,
  multiple = false,
  value,
  onChange,
  preview,
  maxSize = 5,
  className
}: FileUploadZoneProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onChange(e.dataTransfer.files);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files);
    }
  };
  const handleRemove = (indexToRemove?: number) => {
    if (!multiple || indexToRemove === undefined) {
      // Remove all files (for single upload mode)
      onChange(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } else {
      // Remove specific file (for multiple uploads)
      if (value) {
        const dt = new DataTransfer();
        Array.from(value).forEach((file, index) => {
          if (index !== indexToRemove) {
            dt.items.add(file);
          }
        });
        onChange(dt.files.length > 0 ? dt.files : null);

        // Clear input if all files removed
        if (dt.files.length === 0 && inputRef.current) {
          inputRef.current.value = "";
        }
      }
    }
  };
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };
  const files = value ? Array.from(value) : [];
  const previews = preview ? Array.isArray(preview) ? preview : [preview] : [];
  return <div className={cn("w-full", className)}>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} className="hidden" id={inputId} />

      {files.length === 0 ? <label htmlFor={inputId} className={cn("flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors", dragActive ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-accent/50")} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
          <div className="flex flex-col items-center justify-center gap-2">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              <span className="font-semibold">לחץ להעלאה</span> או גרור קבצים
            </p>
            <p className="text-xs text-muted-foreground">
              עד {maxSize}MB
            </p>
          </div>
        </label> : <div className="space-y-2">
          {files.map((file, index) => <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              {previews[index] ? <img src={previews[index]} alt={file.name} className="w-12 h-12 rounded object-cover" /> : file.type.startsWith("image/") ? <ImageIcon className="w-12 h-12 text-muted-foreground" /> : <File className="w-12 h-12 text-muted-foreground" />}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>

              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(multiple ? index : undefined)} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>)}

          
        </div>}
    </div>;
}