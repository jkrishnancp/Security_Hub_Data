"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Users, Shield, BarChart3, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeStepProps {
  onNext: () => void;
  isDark: boolean;
}

export default function WelcomeStep({ onNext, isDark }: WelcomeStepProps) {
  const features = [
    {
      icon: Shield,
      title: "Security Data Integration",
      description: "Centralize data from Tenable, CrowdStrike, AWS Security Hub, and more"
    },
    {
      icon: BarChart3,
      title: "Real-time Dashboards",
      description: "Interactive charts and metrics with trend analysis"
    },
    {
      icon: Users,
      title: "Role-based Access",
      description: "Secure user management with admin, analyst, and viewer roles"
    },
    {
      icon: Building,
      title: "Multi-tenant Support",
      description: "Business unit isolation and customizable reporting"
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-6">
          <div className={cn(
            "p-4 rounded-full",
            isDark ? "bg-blue-900/20" : "bg-blue-50"
          )}>
            <Shield className={cn(
              "h-12 w-12",
              isDark ? "text-blue-400" : "text-blue-600"
            )} />
          </div>
        </div>
        <h1 className={cn(
          "text-4xl font-bold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          Welcome to Security Data Hub
        </h1>
        <p className={cn(
          "text-xl max-w-2xl mx-auto",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>
          Your comprehensive security data management platform. Let's get you set up in just a few minutes.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {features.map((feature, index) => (
          <Card key={index} className={cn(
            "border-2 transition-all duration-200",
            isDark 
              ? "bg-gray-800 border-gray-700 hover:border-blue-500/50" 
              : "bg-white border-gray-200 hover:border-blue-300"
          )}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <feature.icon className={cn(
                  "h-6 w-6",
                  isDark ? "text-blue-400" : "text-blue-600"
                )} />
                <CardTitle className={cn(
                  "text-lg",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {feature.title}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className={isDark ? "text-gray-400" : "text-gray-600"}>
                {feature.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Setup Info */}
      <Card className={cn(
        "border-2",
        isDark ? "bg-gray-800 border-gray-700" : "bg-blue-50 border-blue-200"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className={cn(
              "p-2 rounded-full mt-1",
              isDark ? "bg-blue-900/20" : "bg-blue-100"
            )}>
              <Building className={cn(
                "h-5 w-5",
                isDark ? "text-blue-400" : "text-blue-600"
              )} />
            </div>
            <div className="flex-1">
              <h3 className={cn(
                "font-semibold mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Quick Setup Process
              </h3>
              <p className={cn(
                "text-sm mb-4",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                We'll guide you through setting up your company profile and administrator account. 
                The entire process takes less than 5 minutes.
              </p>
              <ul className={cn(
                "text-sm space-y-1",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                <li>• Company information and domain</li>
                <li>• Administrator account creation</li>
                <li>• Profile customization</li>
                <li>• Security preferences</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Button */}
      <div className="text-center">
        <Button 
          onClick={onNext}
          size="lg"
          className="px-8 py-3 text-lg font-semibold"
        >
          Get Started
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}