"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

// Cache the onboarding status globally to avoid repeated API calls
let cachedOnboardingStatus: { isSetup: boolean; checked: boolean } = { isSetup: false, checked: false };

export default function OnboardingGuard({ children }: OnboardingGuardProps) {
  const [isChecking, setIsChecking] = useState(!cachedOnboardingStatus.checked);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Skip check for onboarding and auth pages
      if (pathname.startsWith('/onboarding') || pathname.startsWith('/auth/login')) {
        setIsChecking(false);
        return;
      }

      // If we already checked and system is set up, skip API call
      if (cachedOnboardingStatus.checked && cachedOnboardingStatus.isSetup) {
        setIsChecking(false);
        return;
      }

      // Check localStorage first to avoid API call
      try {
        const cached = localStorage.getItem('onboarding-status');
        if (cached) {
          const { isSetup, timestamp } = JSON.parse(cached);
          // Cache for 5 minutes
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            cachedOnboardingStatus = { isSetup, checked: true };
            if (!isSetup) {
              setNeedsOnboarding(true);
              router.replace('/onboarding');
              return;
            }
            setIsChecking(false);
            return;
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }

      try {
        const response = await fetch('/api/onboarding/status');
        if (response.ok) {
          const data = await response.json();
          cachedOnboardingStatus = { isSetup: data.isSetup, checked: true };
          
          // Cache in localStorage
          try {
            localStorage.setItem('onboarding-status', JSON.stringify({
              isSetup: data.isSetup,
              timestamp: Date.now()
            }));
          } catch (e) {
            // Ignore localStorage errors
          }
          
          if (!data.isSetup) {
            setNeedsOnboarding(true);
            router.replace('/onboarding');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // On error, assume setup is complete to avoid blocking the app
        cachedOnboardingStatus = { isSetup: true, checked: true };
      } finally {
        setIsChecking(false);
      }
    };

    checkOnboardingStatus();
  }, [router, pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return null; // Router will handle redirect
  }

  return <>{children}</>;
}
