import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  className?: string;
}

export function MultiSelectFilter({ options, selected, onChange, placeholder, className }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const allSelected = selected.length === 0; // empty = all

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => onChange([]);
  const clearAll = () => onChange([]);

  const displayLabel = allSelected
    ? placeholder
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label || placeholder
      : `${selected.length} dipilih`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between gap-1 font-normal", className)}
        >
          <span className="truncate text-sm">{displayLabel}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs rounded-full">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[880px] p-0" align="start">
        <div className="p-2 border-b flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
            Semua
          </Button>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={clearAll}>
              <X className="h-3 w-3 mr-1" /> Reset
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[350px]">
          <div className="p-2 space-y-1">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selected.length === 0 || selected.includes(option.value)}
                  onCheckedChange={() => {
                    if (selected.length === 0) {
                      // Switching from "all" to specific: select only this one
                      onChange([option.value]);
                    } else {
                      toggleOption(option.value);
                    }
                  }}
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
