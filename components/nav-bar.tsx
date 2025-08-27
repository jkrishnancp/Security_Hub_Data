'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Shield, 
  BarChart3, 
  FileText, 
  AlertTriangle, 
  Eye, 
  Cloud, 
  Users, 
  Settings, 
  Upload,
  LogOut,
  Menu,
  X,
  CheckSquare,
  ChevronDown,
  UserCircle,
  UserCog,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const navigation: NavItem[] = [
  { name: `Open Items (${new Date().toISOString().slice(0, 10)})`, href: '/open-items', icon: CheckSquare, roles: ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'] },
  { name: 'Threat Advisories', href: '/issues', icon: AlertTriangle, roles: ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'] },
  { name: 'Security Scorecard', href: '/scorecard', icon: Shield, roles: ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'] },
  { name: 'Detections — Falcon', href: '/detections/falcon', icon: Eye, roles: ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'] },
  { name: 'Detections — Secureworks', href: '/detections/secureworks', icon: Database, roles: ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'] },
  { name: 'Vulnerabilities', href: '/vulnerabilities', icon: FileText, roles: ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'] },
  { name: 'Detections — Cloud', href: '/detections/cloud', icon: Cloud, roles: ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'] },
];

export default function NavBar() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!session) {
    return null;
  }

  const userRole = session.user.role;
  const filteredNavigation = navigation.filter(item => item.roles.includes(userRole));
  const isDark = actualTheme === 'dark';

  // Split navigation for responsive design
  const primaryNavigation = filteredNavigation.slice(0, 3); // First 3 items
  const secondaryNavigation = filteredNavigation.slice(3); // Remaining items

  return (
    <>
      <div className={cn(
        "border-b sticky top-0 z-40 backdrop-blur-sm transition-colors duration-200",
        isDark 
          ? "bg-gray-900/95 border-gray-800" 
          : "bg-white/95 border-gray-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
                  <Shield className={cn(
                    "h-8 w-8",
                    isDark ? "text-blue-400" : "text-blue-600"
                  )} />
                  <span className={cn(
                    "ml-2 text-xl font-bold tracking-tight",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Security DataHub
                  </span>
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden lg:ml-6 lg:flex lg:space-x-1">
                {primaryNavigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "inline-flex items-center px-3 py-2 border-b-2 font-medium text-sm transition-colors duration-200",
                        pathname === item.href
                          ? isDark 
                            ? 'border-blue-400 text-blue-400' 
                            : 'border-blue-500 text-blue-600'
                          : isDark
                            ? 'border-transparent text-gray-300 hover:border-gray-600 hover:text-white'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
                
                {/* More Menu for additional items */}
                {secondaryNavigation.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={cn(
                          "inline-flex items-center px-3 py-2 font-medium text-sm h-auto",
                          isDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-700"
                        )}
                      >
                        More
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {secondaryNavigation.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem key={item.name} asChild>
                            <Link href={item.href} className="flex items-center">
                              <Icon className="h-4 w-4 mr-2" />
                              {item.name}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Tablet Navigation - Condensed */}
              <div className="hidden sm:flex lg:hidden sm:ml-6 sm:space-x-2">
                {primaryNavigation.slice(0, 2).map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "inline-flex items-center px-2 py-2 border-b-2 font-medium text-sm transition-colors",
                        pathname === item.href
                          ? isDark ? 'border-blue-400 text-blue-400' : 'border-blue-500 text-blue-600'
                          : isDark ? 'border-transparent text-gray-300 hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                      )}
                      title={item.name}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="ml-1 hidden md:inline truncate max-w-24">
                        {item.name.split(' ')[0]}
                      </span>
                    </Link>
                  );
                })}
                
                {/* Dropdown for remaining items on tablet */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={cn(
                        "px-2 py-2 h-auto",
                        isDark ? "text-gray-300" : "text-gray-500"
                      )}
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {filteredNavigation.slice(2).map((item) => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem key={item.name} asChild>
                          <Link href={item.href} className="flex items-center">
                            <Icon className="h-4 w-4 mr-2" />
                            {item.name}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Right side - User menu and theme toggle */}
            <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-3">
              <ThemeToggle />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <div className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                      isDark ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"
                    )}>
                      {session.user.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="hidden md:block text-left">
                      <div className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                        {session.user.email?.split('@')[0]}
                      </div>
                      <div className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>
                        {session.user.role}
                      </div>
                    </div>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{session.user.email}</p>
                    <p className="text-xs text-muted-foreground">{session.user.role}</p>
                  </div>
                  <DropdownMenuSeparator />
                  
                  {/* Profile Section */}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center cursor-pointer">
                      <UserCircle className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Link>
                  </DropdownMenuItem>
                  
                  {/* Admin Section - Only show for ADMIN users */}
                  {session.user.role === 'ADMIN' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin/users" className="flex items-center cursor-pointer">
                          <Users className="h-4 w-4 mr-2" />
                          User Management
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/groups" className="flex items-center cursor-pointer">
                          <UserCog className="h-4 w-4 mr-2" />
                          Group Management
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/ingest" className="flex items-center cursor-pointer">
                          <Database className="h-4 w-4 mr-2" />
                          Data Import
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden space-x-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={cn(
                  "inline-flex items-center justify-center p-2 rounded-md",
                  isDark ? "text-gray-400 hover:text-white hover:bg-gray-700" : "text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                )}
              >
                {mobileMenuOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={cn(
            "sm:hidden border-t",
            isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
          )}>
            <div className="pt-2 pb-3 space-y-1 px-2">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors",
                      pathname === item.href
                        ? isDark
                          ? 'bg-blue-900 text-blue-200 border-blue-400'
                          : 'bg-blue-50 text-blue-700 border-blue-500'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
            
            {/* Mobile User Section */}
            <div className={cn(
              "pt-4 pb-3 border-t",
              isDark ? "border-gray-800" : "border-gray-200"
            )}>
              <div className="flex items-center px-5">
                <div className="flex-shrink-0">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center",
                    isDark ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"
                  )}>
                    <span className="text-sm font-medium">
                      {session.user.email?.[0]?.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <div className={cn(
                    "text-base font-medium truncate",
                    isDark ? "text-white" : "text-gray-800"
                  )}>
                    {session.user.email}
                  </div>
                  <div className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}>
                    {session.user.role}
                  </div>
                </div>
              </div>
              <div className="mt-3 px-2 space-y-1">
                <Button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-base font-medium",
                    isDark 
                      ? "text-gray-300 hover:text-white hover:bg-gray-800" 
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  )}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}