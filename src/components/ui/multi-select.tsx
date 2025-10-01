import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "בחר פריטים...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleUnselect = (item: string) => {
    onChange(selected.filter((s) => s !== item));
  };

  const handleSelect = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-[40px] h-auto",
            className
          )}
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length === 0 && (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {selected.map((item) => (
              <Badge
                variant="secondary"
                key={item}
                className="gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnselect(item);
                }}
              >
                {item}
                <X className="h-3 w-3 cursor-pointer" />
              </Badge>
            ))}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
   <PopoverContent className="w-full p-0" align="start" dir="rtl">
  <Command>
    <CommandInput placeholder="חפש..." className="h-9" />
    <CommandList>
      <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>

      <CommandGroup>
        {options.map((option) => (
          <CommandItem
            key={option}
            onSelect={() => handleSelect(option)} // toggle logic expected in handleSelect
            className="cursor-pointer flex flex-row-reverse items-center gap-2 px-3 py-2 hover:bg-muted/60 rounded-md"
            aria-checked={selected.includes(option)}
            role="option"
          >
            {/* Checkbox on the right visually because of flex-row-reverse */}
            <Checkbox
              checked={selected.includes(option)}
              onClick={(e) => {
                e.stopPropagation();        // prevent CommandItem default selection double-fire
                handleSelect(option);       // toggle selection when clicking checkbox
              }}
              className="h-4 w-4 shrink-0"
              aria-label={`בחר ${option}`}
            />

            {/* Label (right-aligned text) */}
            <span className="text-right flex-1" dir="rtl">
              {option}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  </Command>
</PopoverContent>

    </Popover>
  );
}
