"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Import step components
import WelcomeStep from "@/components/onboarding/welcome-step";
import CompanyStep from "@/components/onboarding/company-step";
import AdminStep from "@/components/onboarding/admin-step";
import ProfileStep from "@/components/onboarding/profile-step";
import CompleteStep from "@/components/onboarding/complete-step";

export default function OnboardingPage() {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [checking, setChecking] = useState(true);
  const [formData, setFormData] = useState({
    // Company info
    companyName: "",
    companyDomain: "",
    
    // Admin credentials
    adminEmail: "",
    adminPassword: "",
    confirmPassword: "",
    
    // Profile info
    firstName: "",
    lastName: "",
    displayName: "",
    phone: "",
    department: "",
    location: "",
    avatar: ""
  });

  const steps = [
    { title: "Welcome", component: "welcome" },
    { title: "Company", component: "company" },
    { title: "Admin Account", component: "admin" },
    { title: "Profile", component: "profile" },
    { title: "Complete", component: "complete" }
  ];

  // Check if system is already set up
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch('/api/onboarding/status');
        if (response.ok) {
          const { isSetup } = await response.json();
          if (isSetup) {
            // System is already set up, redirect to login
            router.replace('/auth/login');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkSetupStatus();
  }, [router]);

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = async () => {
    try {
      const response = await fetch('/api/onboarding/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.companyName,
          companyDomain: formData.companyDomain,
          adminEmail: formData.adminEmail,
          adminPassword: formData.adminPassword,
          firstName: formData.firstName,
          lastName: formData.lastName,
          displayName: formData.displayName,
          phone: formData.phone,
          department: formData.department,
          location: formData.location,
          avatar: formData.avatar
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Setup completed:', result);
        
        // Redirect to login page with success message
        router.replace('/auth/login?setup=complete');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Setup failed');
      }
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  };

  // Show loading while checking setup status
  if (checking) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Checking setup status...
          </p>
        </div>
      </div>
    );
  }

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      isDark ? "bg-gray-900" : "bg-gray-50"
    )}>
      {/* Header */}
      <div className={cn(
        "border-b",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm font-medium mb-2">
              <span className={isDark ? "text-gray-300" : "text-gray-700"}>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className={isDark ? "text-gray-300" : "text-gray-700"}>
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress 
              value={progress} 
              className="h-2"
            />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                  index <= currentStep
                    ? "bg-primary text-primary-foreground"
                    : isDark
                      ? "bg-gray-700 text-gray-400"
                      : "bg-gray-200 text-gray-500"
                )}>
                  {index + 1}
                </div>
                <span className={cn(
                  "ml-2 text-sm font-medium hidden sm:block",
                  index <= currentStep
                    ? isDark ? "text-white" : "text-gray-900"
                    : isDark ? "text-gray-400" : "text-gray-500"
                )}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {currentStep === 0 && (
          <WelcomeStep
            onNext={nextStep}
            isDark={isDark}
          />
        )}
        
        {currentStep === 1 && (
          <CompanyStep
            data={{
              companyName: formData.companyName,
              companyDomain: formData.companyDomain
            }}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
            isDark={isDark}
          />
        )}
        
        {currentStep === 2 && (
          <AdminStep
            data={{
              adminEmail: formData.adminEmail,
              adminPassword: formData.adminPassword,
              confirmPassword: formData.confirmPassword
            }}
            companyDomain={formData.companyDomain}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
            isDark={isDark}
          />
        )}
        
        {currentStep === 3 && (
          <ProfileStep
            data={{
              firstName: formData.firstName,
              lastName: formData.lastName,
              displayName: formData.displayName,
              phone: formData.phone,
              department: formData.department,
              location: formData.location,
              avatar: formData.avatar
            }}
            adminEmail={formData.adminEmail}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
            isDark={isDark}
          />
        )}
        
        {currentStep === 4 && (
          <CompleteStep
            data={formData}
            onComplete={completeOnboarding}
            onBack={prevStep}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
}
