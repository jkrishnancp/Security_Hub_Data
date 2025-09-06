"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Building, 
  Shield, 
  User, 
  Mail,
  Globe,
  Loader2,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CompleteStepProps {
  data: {
    companyName: string;
    companyDomain: string;
    adminEmail: string;
    adminPassword: string;
    firstName: string;
    lastName: string;
    displayName: string;
    phone: string;
    department: string;
    location: string;
    avatar: string;
  };
  onComplete: () => Promise<void>;
  onBack: () => void;
  isDark: boolean;
}

export default function CompleteStep({ data, onComplete, onBack, isDark }: CompleteStepProps) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async () => {
    setCompleting(true);
    setError("");
    
    try {
      await onComplete();
    } catch (err) {
      console.error('Setup completion error:', err);
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const getInitials = () => {
    const first = data.firstName?.[0] || data.adminEmail[0];
    const last = data.lastName?.[0] || "";
    return (first + last).toUpperCase();
  };

  const setupItems = [
    {
      icon: Building,
      title: "Company Setup",
      description: `${data.companyName} on ${data.companyDomain}`
    },
    {
      icon: Shield,
      title: "Administrator Account",
      description: data.adminEmail
    },
    {
      icon: User,
      title: "Profile Configuration",
      description: data.displayName || `${data.firstName} ${data.lastName}`.trim() || "Administrator"
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-6">
          <div className={cn(
            "p-4 rounded-full",
            isDark ? "bg-green-900/20" : "bg-green-50"
          )}>
            <CheckCircle className={cn(
              "h-12 w-12",
              isDark ? "text-green-400" : "text-green-600"
            )} />
          </div>
        </div>
        <h2 className={cn(
          "text-3xl font-bold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          Ready to Launch
        </h2>
        <p className={cn(
          "text-lg",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>
          Review your setup and complete the Security Data Hub configuration.
        </p>
      </div>

      {/* Setup Summary */}
      <Card className={cn(
        "border-2",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <CardHeader>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            <CheckCircle className="h-5 w-5" />
            Setup Summary
          </CardTitle>
          <CardDescription>
            Verify the configuration before completing setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Setup Items */}
          <div className="space-y-4">
            {setupItems.map((item, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-full",
                  isDark ? "bg-green-900/20" : "bg-green-50"
                )}>
                  <item.icon className={cn(
                    "h-4 w-4",
                    isDark ? "text-green-400" : "text-green-600"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    "font-medium",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    {item.title}
                  </h4>
                  <p className={cn(
                    "text-sm truncate",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Profile Preview */}
          <div className={cn(
            "p-4 rounded-lg border",
            isDark ? "bg-gray-750 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={data.avatar} />
                <AvatarFallback className={cn(
                  "text-lg font-semibold",
                  isDark ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"
                )}>
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn(
                    "text-lg font-semibold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    {data.displayName || `${data.firstName} ${data.lastName}`.trim() || "Administrator"}
                  </h3>
                  <span className={cn(
                    "px-2 py-1 text-xs font-medium rounded",
                    isDark ? "bg-red-900/20 text-red-300" : "bg-red-50 text-red-700"
                  )}>
                    ADMIN
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="h-3 w-3" />
                    {data.adminEmail}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Globe className="h-3 w-3" />
                    {data.companyName}
                  </div>
                  {(data.department || data.location) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Building className="h-3 w-3" />
                      {[data.department, data.location].filter(Boolean).join(' • ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Happens Next */}
      <Card className={cn(
        "border-2",
        isDark ? "bg-primary/5 border-primary/20" : "bg-primary/10 border-primary/30"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className={cn(
              "p-2 rounded-full",
              isDark ? "bg-primary/20" : "bg-primary/15"
            )}>
              <ArrowRight className={cn(
                "h-5 w-5",
                "text-primary"
              )} />
            </div>
            <div>
              <h3 className={cn(
                "font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>
                What happens next?
              </h3>
              <ul className={cn(
                "text-sm space-y-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Your administrator account will be created
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Database will be initialized with your company settings
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  You'll be redirected to the login page
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Access the full Security Data Hub dashboard
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className={cn(
          "border-2 border-red-500",
          isDark ? "bg-red-900/10" : "bg-red-50"
        )}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-red-500 rounded-full">
                <X className="h-3 w-3 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-red-700 dark:text-red-400 mb-1">
                  Setup Error
                </h4>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={completing}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleComplete}
          disabled={completing}
          size="lg"
          className="px-8 py-3 text-lg font-semibold"
        >
          {completing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              Complete Setup
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
