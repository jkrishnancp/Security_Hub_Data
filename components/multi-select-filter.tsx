"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  isDark: boolean;
  maxDisplayItems?: number;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onSelectionChange,
  isDark,
  maxDisplayItems = 2,
  placeholder = "Select options"
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (value: string) => {
    const isSelected = selectedValues.includes(value);
    if (isSelected) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...options]);
    }
  };

  const displayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length <= maxDisplayItems) {
      return selectedValues.join(', ');
    }
    return `${selectedValues.slice(0, maxDisplayItems).join(', ')} +${selectedValues.length - maxDisplayItems} more`;
  };

  const allSelected = selectedValues.length === options.length;
  const someSelected = selectedValues.length > 0;

  return (
    <div className="space-y-2">
      <label className={cn(
        "text-sm font-medium",
        isDark ? "text-gray-300" : "text-gray-700"
      )}>
        {label}
      </label>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between text-left font-normal",
              isDark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-white hover:bg-gray-50",
              selectedValues.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate">{displayText()}</span>
            <div className="flex items-center gap-1">
              {selectedValues.length > 0 && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className={cn(
                    "rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600",
                    "transition-colors"
                  )}
                >
                  <X className="h-3 w-3" />
                </div>
              )}
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </Button>
        </PopoverTrigger>
        
        <PopoverContent
          className={cn(
            "w-80 p-0",
            isDark ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200"
          )}
          align="start"
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <span className={cn(
                "font-medium text-sm",
                isDark ? "text-gray-200" : "text-gray-900"
              )}>
                {label}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 px-2 text-xs"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <div
                key={option}
                className={cn(
                  "flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700",
                  "cursor-pointer transition-colors"
                )}
                onClick={() => handleToggle(option)}
              >
                <Checkbox
                  id={`${label}-${option}`}
                  checked={selectedValues.includes(option)}
                  onChange={() => handleToggle(option)}
                  className="pointer-events-none"
                />
                <label
                  htmlFor={`${label}-${option}`}
                  className={cn(
                    "text-sm flex-1 cursor-pointer",
                    isDark ? "text-gray-200" : "text-gray-900"
                  )}
                >
                  {option}
                </label>
              </div>
            ))}
          </div>
          
          {selectedValues.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-600">
              <div className={cn(
                "text-xs",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                {selectedValues.length} of {options.length} selected
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}