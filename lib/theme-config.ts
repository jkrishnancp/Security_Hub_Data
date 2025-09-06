// Centralized theme configuration for Security Data Hub

// Metallic Color Palette
export const METALLIC_COLORS = {
  // Severity Colors (Metallic finish)
  critical: '#C41E3A',    // Deep metallic red
  high: '#FF6B35',        // Metallic orange-red
  medium: '#FFB347',      // Metallic peach/orange
  low: '#50C878',         // Metallic emerald
  info: '#4682B4',        // Metallic steel blue
  
  // Status Colors (Metallic finish)
  open: '#DC143C',        // Crimson metallic
  closed: '#228B22',      // Forest green metallic
  inProgress: '#FF8C00',  // Dark orange metallic
  pending: '#9932CC',     // Dark orchid metallic
  resolved: '#32CD32',    // Lime green metallic
  
  // Assignee/User Colors (Metallic variations)
  user1: '#708090',       // Slate gray metallic
  user2: '#2F4F4F',       // Dark slate gray metallic
  user3: '#696969',       // Dim gray metallic
  user4: '#778899',       // Light slate gray metallic
  user5: '#C0C0C0',       // Silver metallic
  user6: '#A9A9A9',       // Dark gray metallic
  
  // Chart Accent Colors
  primary: '#1C1C1C',     // Charcoal metallic
  secondary: '#36454F',   // Charcoal blue metallic
  tertiary: '#708090',    // Slate gray metallic
  
  // Background variations for dark/light theme
  darkBg: '#0F0F0F',      // Deep charcoal
  lightBg: '#F8F9FA',     // Light gray
};

// Chart Color Mappings
export const SEVERITY_COLORS = {
  'CRITICAL': METALLIC_COLORS.critical,
  'HIGH': METALLIC_COLORS.high,
  'MEDIUM': METALLIC_COLORS.medium,
  'LOW': METALLIC_COLORS.low,
  'INFO': METALLIC_COLORS.info,
  // Lowercase versions
  'critical': METALLIC_COLORS.critical,
  'high': METALLIC_COLORS.high,
  'medium': METALLIC_COLORS.medium,
  'low': METALLIC_COLORS.low,
  'info': METALLIC_COLORS.info,
};

export const STATUS_COLORS = {
  'OPEN': METALLIC_COLORS.open,
  'CLOSED': METALLIC_COLORS.closed,
  'IN_PROGRESS': METALLIC_COLORS.inProgress,
  'PENDING': METALLIC_COLORS.pending,
  'RESOLVED': METALLIC_COLORS.resolved,
  'TO DO': METALLIC_COLORS.pending,
  'DONE': METALLIC_COLORS.resolved,
  // Lowercase versions
  'open': METALLIC_COLORS.open,
  'closed': METALLIC_COLORS.closed,
  'in_progress': METALLIC_COLORS.inProgress,
  'pending': METALLIC_COLORS.pending,
  'resolved': METALLIC_COLORS.resolved,
  'to do': METALLIC_COLORS.pending,
  'done': METALLIC_COLORS.resolved,
};

// Assignee color rotation
export const ASSIGNEE_COLORS = [
  METALLIC_COLORS.user1,
  METALLIC_COLORS.user2,
  METALLIC_COLORS.user3,
  METALLIC_COLORS.user4,
  METALLIC_COLORS.user5,
  METALLIC_COLORS.user6,
];

// Utility functions
export const getSeverityColor = (severity: string): string => {
  return SEVERITY_COLORS[severity.toUpperCase() as keyof typeof SEVERITY_COLORS] || METALLIC_COLORS.info;
};

export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status.toUpperCase() as keyof typeof STATUS_COLORS] || METALLIC_COLORS.pending;
};

export const getAssigneeColor = (assignee: string): string => {
  // Generate consistent color for assignee based on name hash
  let hash = 0;
  for (let i = 0; i < assignee.length; i++) {
    hash = assignee.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ASSIGNEE_COLORS[Math.abs(hash) % ASSIGNEE_COLORS.length];
};

// Badge CSS classes for light/dark theme compatibility
export const getSeverityBadgeClass = (severity: string, isDark = false): string => {
  const base = 'px-2 py-1 text-xs font-medium rounded-full border';
  
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return `${base} ${isDark ? 'bg-red-900 text-red-100 border-red-700' : 'bg-red-100 text-red-800 border-red-200'}`;
    case 'HIGH':
      // Dark theme tweak: brighter orange for clear contrast
      return `${base} ${isDark ? 'bg-orange-600 text-white border-orange-500' : 'bg-orange-100 text-orange-800 border-orange-200'}`;
    case 'MEDIUM':
      // Dark theme tweak: use vivid yellow with dark text for readability
      return `${base} ${isDark ? 'bg-yellow-600 text-gray-900 border-yellow-500' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`;
    case 'LOW':
      return `${base} ${isDark ? 'bg-green-900 text-green-100 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}`;
    default:
      return `${base} ${isDark ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-200'}`;
  }
};

export const getStatusBadgeClass = (status: string, isDark = false): string => {
  const base = 'px-2 py-1 text-xs font-medium rounded-full border';
  
  const normalizedStatus = status.toUpperCase();
  if (['OPEN', 'TO DO', 'PENDING'].includes(normalizedStatus)) {
    return `${base} ${isDark ? 'bg-red-900 text-red-100 border-red-700' : 'bg-red-100 text-red-800 border-red-200'}`;
  }
  if (['CLOSED', 'DONE', 'RESOLVED'].includes(normalizedStatus)) {
    return `${base} ${isDark ? 'bg-green-900 text-green-100 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}`;
  }
  if (['IN_PROGRESS', 'IN PROGRESS'].includes(normalizedStatus)) {
    return `${base} ${isDark ? 'bg-orange-900 text-orange-100 border-orange-700' : 'bg-orange-100 text-orange-800 border-orange-200'}`;
  }
  
  return `${base} ${isDark ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-200'}`;
};

// Typography scale
export const TYPOGRAPHY = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'monospace'],
  },
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px  
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

// Responsive breakpoints
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Standard filter configuration
export interface FilterConfig {
  searchPlaceholder: string;
  dateRanges: Array<{ label: string; value: string }>;
  sortOptions: Array<{ label: string; value: string }>;
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  searchPlaceholder: "Search...",
  dateRanges: [
    { label: "All Time", value: "ALL" },
    { label: "Last 7 Days", value: "LAST_7_DAYS" },
    { label: "Last 30 Days", value: "LAST_30_DAYS" },
    { label: "Last 90 Days", value: "LAST_90_DAYS" },
  ],
  sortOptions: [
    { label: "Date (Newest)", value: "date_desc" },
    { label: "Date (Oldest)", value: "date_asc" },
    { label: "Title A-Z", value: "title_asc" },
    { label: "Title Z-A", value: "title_desc" },
    { label: "Priority", value: "priority_desc" },
  ],
};
