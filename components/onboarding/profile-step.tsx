"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Upload, Phone, MapPin, Building, ArrowRight, ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileStepProps {
  data: {
    firstName: string;
    lastName: string;
    displayName: string;
    phone: string;
    department: string;
    location: string;
    avatar: string;
  };
  adminEmail: string;
  onUpdate: (data: Partial<{
    firstName: string;
    lastName: string;
    displayName: string;
    phone: string;
    department: string;
    location: string;
    avatar: string;
  }>) => void;
  onNext: () => void;
  onBack: () => void;
  isDark: boolean;
}

export default function ProfileStep({ data, adminEmail, onUpdate, onNext, onBack, isDark }: ProfileStepProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors({ ...errors, avatar: "Please select a JPEG, PNG, GIF, or WebP image." });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, avatar: "Image must be smaller than 5MB." });
      return;
    }

    setUploadingAvatar(true);
    setErrors({ ...errors, avatar: "" });

    try {
      // For now, we'll just create a data URL for preview
      // In a real implementation, you might upload to a service
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onUpdate({ avatar: dataUrl });
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setErrors({ ...errors, avatar: "Failed to upload avatar. Please try again." });
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = () => {
    onUpdate({ avatar: "" });
  };

  const validateAndNext = () => {
    const newErrors: { [key: string]: string } = {};

    // Phone validation (optional but if provided, should be valid)
    if (data.phone && !/^[\+]?[1-9][\d\s\-\(\)]{7,20}$/.test(data.phone.replace(/[\s\-\(\)]/g, ""))) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  const getInitials = () => {
    const first = data.firstName?.[0] || adminEmail[0];
    const last = data.lastName?.[0] || "";
    return (first + last).toUpperCase();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-6">
          <div className={cn(
            "p-4 rounded-full",
            isDark ? "bg-primary/20" : "bg-primary/10"
          )}>
            <User className={cn(
              "h-12 w-12",
              "text-primary"
            )} />
          </div>
        </div>
        <h2 className={cn(
          "text-3xl font-bold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          Your Profile
        </h2>
        <p className={cn(
          "text-lg",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>
          Personalize your administrator profile. You can update this information later.
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
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            This information will be displayed in your profile and throughout the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={data.avatar} />
                <AvatarFallback className={cn(
                  "text-xl font-semibold",
                  isDark ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"
                )}>
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {data.avatar && (
                <button
                  onClick={removeAvatar}
                  className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            
            <div className="flex flex-col items-center space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
                disabled={uploadingAvatar}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('avatar-upload')?.click()}
                disabled={uploadingAvatar}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploadingAvatar ? "Uploading..." : "Upload Photo"}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                JPG, PNG, GIF or WebP. Max size 5MB.
              </p>
            </div>
            {errors.avatar && (
              <p className="text-sm text-red-500 text-center">{errors.avatar}</p>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name
              </Label>
              <Input
                id="firstName"
                value={data.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="John"
                className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name
              </Label>
              <Input
                id="lastName"
                value={data.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                placeholder="Doe"
                className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
              />
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={data.displayName}
              onChange={(e) => handleInputChange("displayName", e.target.value)}
              placeholder="How you'd like to be addressed"
              className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
            />
            <p className="text-xs text-gray-500">
              If empty, we'll use your first name or email username.
            </p>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className={cn(
              "font-medium",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Contact Information (Optional)
            </h4>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={data.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className={cn(
                    "pl-10",
                    errors.phone && "border-red-500 focus:border-red-500",
                    isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                  )}
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone}</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium">
                  Department
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="department"
                    value={data.department}
                    onChange={(e) => handleInputChange("department", e.target.value)}
                    placeholder="IT Security, Engineering, etc."
                    className={cn(
                      "pl-10",
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium">
                  Location
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="location"
                    value={data.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    placeholder="San Jose, CA / Remote"
                    className={cn(
                      "pl-10",
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className={cn(
            "p-4 rounded-lg border",
            isDark 
              ? "bg-gray-750 border-gray-600" 
              : "bg-gray-50 border-gray-200"
          )}>
            <p className="text-sm font-medium mb-3">Profile Preview</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={data.avatar} />
                <AvatarFallback className={cn(
                  "text-sm font-semibold",
                  isDark ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"
                )}>
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className={cn(
                  "font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {data.displayName || `${data.firstName} ${data.lastName}`.trim() || adminEmail.split('@')[0]}
                </p>
                <p className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>
                  {adminEmail}
                </p>
                {(data.department || data.location) && (
                  <p className={cn(
                    "text-xs",
                    isDark ? "text-gray-500" : "text-gray-400"
                  )}>
                    {[data.department, data.location].filter(Boolean).join(' • ')}
                  </p>
                )}
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
