'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  Filter, 
  RefreshCw, 
  Calendar as CalendarIcon, 
  X,
  Download,
  Upload,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

export interface FilterOption {
  label: string;
  value: string;
}

export interface DateRangeType {
  from: Date | undefined;
  to: Date | undefined;
}

export interface StandardFiltersProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Generic filters - each page can define their own
  filters: Array<{
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
    width?: string;
  }>;

  // Date range
  dateRange: DateRangeType;
  onDateRangeChange: (range: DateRangeType) => void;
  datePreset: string;
  onDatePresetChange: (preset: string) => void;

  // Sort
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortByChange: (value: string) => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  sortOptions: FilterOption[];

  // Actions
  onRefresh?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  showStats?: boolean;
  onToggleStats?: () => void;

  // Results summary
  totalResults: number;
  filteredResults: number;

  // Additional custom actions
  customActions?: React.ReactNode;
}

const datePresets = [
  { label: "All Time", value: "ALL" },
  { label: "Last 7 Days", value: "LAST_7_DAYS" },
  { label: "Last 15 Days", value: "LAST_15_DAYS" },
  { label: "Last 21 Days", value: "LAST_21_DAYS" },
  { label: "Last 30 Days", value: "LAST_30_DAYS" },
  { label: "Last 45 Days", value: "LAST_45_DAYS" },
  { label: "Last 60 Days", value: "LAST_60_DAYS" },
  { label: "Last 90 Days", value: "LAST_90_DAYS" },
];

export function StandardFilters({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  dateRange,
  onDateRangeChange,
  datePreset,
  onDatePresetChange,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  sortOptions,
  onRefresh,
  onExport,
  onImport,
  showStats = false,
  onToggleStats,
  totalResults,
  filteredResults,
  customActions,
}: StandardFiltersProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (datePreset !== 'ALL') count++;
    filters.forEach(filter => {
      if (filter.value !== 'ALL') count++;
    });
    return count;
  };

  const clearAllFilters = () => {
    onSearchChange('');
    onDatePresetChange('ALL');
    onDateRangeChange({ from: undefined, to: undefined });
    filters.forEach(filter => {
      filter.onChange('ALL');
    });
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="space-y-4">
      {/* Top row - Main search and quick actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center min-w-0 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0 max-w-md">
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "w-full pr-10",
                isDark ? "bg-gray-800 border-gray-600" : "bg-white"
              )}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Results Summary */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
            <span>
              {filteredResults === totalResults 
                ? `${totalResults} items` 
                : `${filteredResults} of ${totalResults} items`
              }
            </span>
            {activeFiltersCount > 0 && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  isDark ? "border-gray-600" : "border-gray-300"
                )}
              >
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onToggleStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleStats}
              className={cn(
                "hidden sm:flex",
                showStats ? "bg-primary text-primary-foreground" : ""
              )}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Charts
            </Button>
          )}
          
          {onImport && (
            <Button variant="outline" size="sm" onClick={onImport} className="hidden sm:flex">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          )}
          
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="hidden sm:flex">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          {customActions}
        </div>
      </div>

      {/* Second row - Filters */}
      <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Filters:
          </span>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-2 items-center flex-1 min-w-0">
          {/* Date Preset */}
          <Select value={datePreset} onValueChange={onDatePresetChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {datePresets.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Custom range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={(range) => {
                  onDateRangeChange({ from: range?.from, to: range?.to });
                  if (range?.from && range?.to) {
                    onDatePresetChange('CUSTOM');
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {/* Dynamic Filters */}
          {filters.map((filter) => (
            <Select key={filter.key} value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger className={filter.width || "w-32"}>
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {/* Sort */}
          <Select value={`${sortBy}_${sortOrder}`} onValueChange={(value) => {
            const [field, order] = value.split('_');
            onSortByChange(field);
            onSortOrderChange(order as 'asc' | 'desc');
          }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Actions (shown only on small screens) */}
      <div className="flex sm:hidden gap-2 overflow-x-auto pb-2">
        {onToggleStats && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleStats}
            className={showStats ? "bg-primary text-primary-foreground" : ""}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Charts
          </Button>
        )}
        
        {onImport && (
          <Button variant="outline" size="sm" onClick={onImport}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        )}
        
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>
    </div>
  );
}