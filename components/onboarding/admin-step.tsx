"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStepProps {
  data: {
    adminEmail: string;
    adminPassword: string;
    confirmPassword: string;
  };
  companyDomain: string;
  onUpdate: (data: Partial<{ adminEmail: string; adminPassword: string; confirmPassword: string; }>) => void;
  onNext: () => void;
  onBack: () => void;
  isDark: boolean;
}

export default function AdminStep({ data, companyDomain, onUpdate, onNext, onBack, isDark }: AdminStepProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateAndNext = () => {
    const newErrors: { [key: string]: string } = {};

    // Validate email
    if (!data.adminEmail.trim()) {
      newErrors.adminEmail = "Admin email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.adminEmail.trim())) {
        newErrors.adminEmail = "Please enter a valid email address";
      }
    }

    // Validate password
    if (!data.adminPassword) {
      newErrors.adminPassword = "Password is required";
    } else if (data.adminPassword.length < 8) {
      newErrors.adminPassword = "Password must be at least 8 characters long";
    } else {
      // Check for password strength
      const hasUpperCase = /[A-Z]/.test(data.adminPassword);
      const hasLowerCase = /[a-z]/.test(data.adminPassword);
      const hasNumbers = /\d/.test(data.adminPassword);
      const hasNonalphas = /\W/.test(data.adminPassword);
      
      if (!(hasUpperCase && hasLowerCase && (hasNumbers || hasNonalphas))) {
        newErrors.adminPassword = "Password should contain uppercase, lowercase, and numbers/symbols";
      }
    }

    // Validate password confirmation
    if (!data.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (data.adminPassword !== data.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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

  const getPasswordStrength = (password: string) => {
    if (password.length < 8) return { score: 0, label: "Too short", color: "text-red-500" };
    
    let score = 0;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/\W/.test(password)) score++;
    
    if (score === 4) return { score: 4, label: "Strong", color: "text-green-500" };
    if (score === 3) return { score: 3, label: "Good", color: "text-primary" };
    if (score === 2) return { score: 2, label: "Fair", color: "text-yellow-500" };
    return { score: 1, label: "Weak", color: "text-red-500" };
  };

  const passwordStrength = data.adminPassword ? getPasswordStrength(data.adminPassword) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-6">
          <div className={cn(
            "p-4 rounded-full",
            isDark ? "bg-primary/20" : "bg-primary/10"
          )}>
            <Shield className={cn(
              "h-12 w-12",
              "text-primary"
            )} />
          </div>
        </div>
        <h2 className={cn(
          "text-3xl font-bold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          Administrator Account
        </h2>
        <p className={cn(
          "text-lg",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>
          Create your administrator account to manage the Security Data Hub.
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
            <Shield className="h-5 w-5" />
            Admin Credentials
          </CardTitle>
          <CardDescription>
            This account will have full administrative privileges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admin Email */}
          <div className="space-y-2">
            <Label htmlFor="adminEmail" className="text-sm font-medium">
              Administrator Email *
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="adminEmail"
                type="email"
                value={data.adminEmail}
                onChange={(e) => handleInputChange("adminEmail", e.target.value)}
                placeholder={`admin@${companyDomain || "company.com"}`}
                className={cn(
                  "pl-10",
                  errors.adminEmail && "border-red-500 focus:border-red-500",
                  isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                )}
              />
            </div>
            {errors.adminEmail && (
              <p className="text-sm text-red-500">{errors.adminEmail}</p>
            )}
            {companyDomain && (
              <p className="text-xs text-gray-500">
                Recommended: Use an email address with your domain ({companyDomain})
              </p>
            )}
          </div>

          {/* Admin Password */}
          <div className="space-y-2">
            <Label htmlFor="adminPassword" className="text-sm font-medium">
              Password *
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="adminPassword"
                type={showPassword ? "text" : "password"}
                value={data.adminPassword}
                onChange={(e) => handleInputChange("adminPassword", e.target.value)}
                placeholder="Create a strong password"
                className={cn(
                  "pl-10 pr-10",
                  errors.adminPassword && "border-red-500 focus:border-red-500",
                  isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordStrength && (
              <div className="flex items-center gap-2">
                <div className={cn("text-xs font-medium", passwordStrength.color)}>
                  {passwordStrength.label}
                </div>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-300",
                      passwordStrength.score === 1 && "w-1/4 bg-red-500",
                      passwordStrength.score === 2 && "w-2/4 bg-yellow-500",
                      passwordStrength.score === 3 && "w-3/4 bg-primary",
                      passwordStrength.score === 4 && "w-full bg-green-500"
                    )}
                  />
                </div>
              </div>
            )}
            {errors.adminPassword && (
              <p className="text-sm text-red-500">{errors.adminPassword}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password *
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={data.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                placeholder="Confirm your password"
                className={cn(
                  "pl-10 pr-10",
                  errors.confirmPassword && "border-red-500 focus:border-red-500",
                  isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Security Notice */}
          <div className={cn(
            "p-4 rounded-lg border flex items-start gap-3",
            isDark 
              ? "bg-amber-900/10 border-amber-800 text-amber-200" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          )}>
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Security Best Practices</p>
              <ul className="space-y-1 opacity-90 text-xs">
                <li>• Use a unique password not used elsewhere</li>
                <li>• Include uppercase, lowercase, numbers, and symbols</li>
                <li>• Keep your credentials secure and private</li>
                <li>• Change the password regularly</li>
              </ul>
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
