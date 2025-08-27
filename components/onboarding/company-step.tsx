"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building, Globe, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyStepProps {
  data: {
    companyName: string;
    companyDomain: string;
  };
  onUpdate: (data: Partial<{ companyName: string; companyDomain: string; }>) => void;
  onNext: () => void;
  onBack: () => void;
  isDark: boolean;
}

export default function CompanyStep({ data, onUpdate, onNext, onBack, isDark }: CompanyStepProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateAndNext = () => {
    const newErrors: { [key: string]: string } = {};

    // Validate company name
    if (!data.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }

    // Validate domain
    if (!data.companyDomain.trim()) {
      newErrors.companyDomain = "Company domain is required";
    } else {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,})+$/;
      if (!domainRegex.test(data.companyDomain.trim())) {
        newErrors.companyDomain = "Please enter a valid domain (e.g., company.com)";
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-6">
          <div className={cn(
            "p-4 rounded-full",
            isDark ? "bg-blue-900/20" : "bg-blue-50"
          )}>
            <Building className={cn(
              "h-12 w-12",
              isDark ? "text-blue-400" : "text-blue-600"
            )} />
          </div>
        </div>
        <h2 className={cn(
          "text-3xl font-bold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          Company Information
        </h2>
        <p className={cn(
          "text-lg",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>
          Tell us about your organization to customize your Security Data Hub experience.
        </p>
      </div>

      {/* Form */}
      <Card className={cn(
        "border-2",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <CardHeader>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            <Building className="h-5 w-5" />
            Organization Details
          </CardTitle>
          <CardDescription>
            This information will be used to configure your Security Data Hub instance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-sm font-medium">
              Company Name *
            </Label>
            <Input
              id="companyName"
              value={data.companyName}
              onChange={(e) => handleInputChange("companyName", e.target.value)}
              placeholder="e.g., NETGEAR Inc."
              className={cn(
                errors.companyName && "border-red-500 focus:border-red-500",
                isDark ? "bg-gray-700 border-gray-600" : "bg-white"
              )}
            />
            {errors.companyName && (
              <p className="text-sm text-red-500">{errors.companyName}</p>
            )}
          </div>

          {/* Company Domain */}
          <div className="space-y-2">
            <Label htmlFor="companyDomain" className="text-sm font-medium">
              Company Domain *
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="companyDomain"
                value={data.companyDomain}
                onChange={(e) => handleInputChange("companyDomain", e.target.value.toLowerCase())}
                placeholder="e.g., netgear.com"
                className={cn(
                  "pl-10",
                  errors.companyDomain && "border-red-500 focus:border-red-500",
                  isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                )}
              />
            </div>
            {errors.companyDomain && (
              <p className="text-sm text-red-500">{errors.companyDomain}</p>
            )}
            <p className="text-xs text-gray-500">
              This domain will be used for email validation and branding.
            </p>
          </div>

          {/* Info Box */}
          <div className={cn(
            "p-4 rounded-lg border",
            isDark 
              ? "bg-blue-900/10 border-blue-800 text-blue-200" 
              : "bg-blue-50 border-blue-200 text-blue-800"
          )}>
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Domain Usage</p>
                <p className="opacity-90">
                  Your domain will be used to validate admin email addresses and can be used 
                  for future integrations and branding customization.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={validateAndNext}
          className="flex items-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}