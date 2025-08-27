"use client";

import React, { useState, useEffect } from "react";
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserCircle, Save, Upload, Mail, Phone, MapPin, Building, Calendar, Shield } from "lucide-react";
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Profile state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    phone: "",
    department: "",
    location: "",
    bio: "",
    avatar: ""
  });

  // Load user profile data
  useEffect(() => {
    async function loadProfile() {
      if (session?.user) {
        try {
          const response = await fetch('/api/profile');
          if (response.ok) {
            const userData = await response.json();
            setProfileData({
              firstName: userData.firstName || "",
              lastName: userData.lastName || "",
              displayName: userData.displayName || userData.email?.split('@')[0] || "",
              phone: userData.phone || "",
              department: userData.department || "",
              location: userData.location || "",
              bio: userData.bio || "",
              avatar: userData.avatar || ""
            });
          } else {
            // Fallback to session data
            setProfileData({
              firstName: session.user.firstName || "",
              lastName: session.user.lastName || "",
              displayName: session.user.displayName || session.user.email?.split('@')[0] || "",
              phone: session.user.phone || "",
              department: session.user.department || "",
              location: session.user.location || "",
              bio: "",
              avatar: session.user.avatar || ""
            });
          }
        } catch (error) {
          console.error('Error loading profile:', error);
          // Use session data as fallback
          setProfileData({
            firstName: session.user.firstName || "",
            lastName: session.user.lastName || "",
            displayName: session.user.displayName || session.user.email?.split('@')[0] || "",
            phone: session.user.phone || "",
            department: session.user.department || "",
            location: session.user.location || "",
            bio: "",
            avatar: session.user.avatar || ""
          });
        }
      }
    }

    loadProfile();
  }, [session]);

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        // Update the session with new profile data
        await update({
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          displayName: updatedUser.displayName,
          avatar: updatedUser.avatar,
          department: updatedUser.department,
          phone: updatedUser.phone,
          location: updatedUser.location,
        });
        setMessage("Profile updated successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage("Failed to update profile. Please try again.");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessage("File too large. Please select an image under 5MB.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    setSaving(true);
    setMessage("Uploading avatar...");

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const uploadResponse = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        const { avatarUrl } = await uploadResponse.json();
        
        // Create updated profile data with new avatar URL
        const updatedProfileData = {
          ...profileData,
          avatar: avatarUrl
        };
        
        // Update profile data state
        setProfileData(updatedProfileData);

        // Save the profile with the new avatar URL
        const profileResponse = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProfileData),
        });

        if (profileResponse.ok) {
          const updatedUser = await profileResponse.json();
          await update({
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            displayName: updatedUser.displayName,
            avatar: updatedUser.avatar,
            department: updatedUser.department,
            phone: updatedUser.phone,
            location: updatedUser.location,
          });
          setMessage("Avatar updated successfully!");
          setTimeout(() => setMessage(""), 3000);
        } else {
          throw new Error('Failed to save profile with new avatar');
        }
      } else {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage(`Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <AuthGuard>
      <div className={cn(
        "min-h-screen transition-colors duration-200",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <NavBar />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className={cn(
              "text-3xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>User Profile</h1>
            <p className={cn(
              "mt-1",
              isDark ? "text-gray-400" : "text-gray-500"
            )}>
              Manage your account settings and personal information
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Profile Picture & Basic Info */}
            <Card className={cn(
              "lg:col-span-1",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader className="text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={profileData.avatar || session.user.avatar} />
                      <AvatarFallback className={cn(
                        "text-xl font-semibold",
                        isDark ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"
                      )}>
                        {(profileData.firstName?.[0] || session.user.firstName?.[0] || session.user.email?.[0])?.toUpperCase()}{(profileData.lastName?.[0] || session.user.lastName?.[0])?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                    >
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="text-center">
                    <h3 className={cn(
                      "text-lg font-medium",
                      isDark ? "text-white" : "text-gray-900"
                    )}>
                      {profileData.displayName || session.user.email?.split('@')[0]}
                    </h3>
                    <p className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      {session.user.email}
                    </p>
                    <Badge className="mt-2" variant="secondary">
                      {session.user.role}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span>{profileData.department || "Not specified"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{profileData.location || "Not specified"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>Joined {new Date(session.user.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editable Profile Fields */}
            <Card className={cn(
              "lg:col-span-2",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader>
                <CardTitle className={cn(
                  "flex items-center gap-2",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <UserCircle className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details. Email address cannot be changed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="Enter your first name"
                      className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Enter your last name"
                      className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={profileData.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    placeholder="How you'd like to be addressed"
                    className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={session.user.email || ""}
                      disabled
                      className={cn(
                        "pl-10 cursor-not-allowed",
                        isDark ? "bg-gray-700 border-gray-600 text-gray-400" : "bg-gray-100 border-gray-300 text-gray-500"
                      )}
                    />
                  </div>
                  <p className="text-xs text-gray-400">Email address cannot be changed for security reasons</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className={cn(
                        "pl-10",
                        isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                      )}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={profileData.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      placeholder="IT Security, Engineering, etc."
                      className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={profileData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="City, State / Remote"
                      className={isDark ? "bg-gray-700 border-gray-600" : "bg-white"}
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  {message && (
                    <div className={cn(
                      "px-3 py-1 rounded-md text-sm",
                      message.includes("successfully") 
                        ? isDark ? "bg-green-900/20 text-green-400 border border-green-800" : "bg-green-50 text-green-600 border border-green-200"
                        : isDark ? "bg-red-900/20 text-red-400 border border-red-800" : "bg-red-50 text-red-600 border border-red-200"
                    )}>
                      {message}
                    </div>
                  )}
                  <div className="ml-auto">
                    <Button 
                      onClick={handleSave} 
                      disabled={saving}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}