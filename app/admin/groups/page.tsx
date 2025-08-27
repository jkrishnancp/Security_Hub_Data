"use client";

import React, { useState, useEffect } from "react";
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  UserCog, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Users,
  RefreshCw,
  Building
} from "lucide-react";
import { cn } from '@/lib/utils';

interface Group {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function GroupManagementPage() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // New group dialog state
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);

  // Check if user is admin
  if (session?.user.role !== 'ADMIN') {
    return (
      <AuthGuard>
        <div className={cn(
          "min-h-screen flex items-center justify-center",
          isDark ? "bg-gray-900" : "bg-gray-50"
        )}>
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Shield className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>You need administrator privileges to access this page.</p>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      // For now, using mock data since we don't have groups in the schema yet
      // In a real implementation, this would fetch from /api/admin/groups
      const mockGroups: Group[] = [
        {
          id: '1',
          name: 'Security Team',
          description: 'Core security analysts and incident responders',
          memberCount: 8,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2', 
          name: 'IT Operations',
          description: 'Infrastructure and operations team members',
          memberCount: 12,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Business Unit Leaders',
          description: 'Department heads and business unit leads',
          memberCount: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '4',
          name: 'External Vendors',
          description: 'Third-party security vendors and consultants',
          memberCount: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];
      
      setGroups(mockGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = !searchTerm || 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const handleCreateGroup = async () => {
    setSaving(true);
    try {
      // Mock implementation - in reality this would POST to /api/admin/groups
      const newGroup: Group = {
        id: Date.now().toString(),
        name: newGroupData.name,
        description: newGroupData.description,
        memberCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setGroups([...groups, newGroup]);
      setShowNewGroupDialog(false);
      setNewGroupData({ name: '', description: '' });
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    
    try {
      // Mock implementation - in reality this would DELETE /api/admin/groups/{id}
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  return (
    <AuthGuard>
      <div className={cn(
        "min-h-screen transition-colors duration-200",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <NavBar />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>Group Management</h1>
              <p className={cn(
                "mt-1",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                Organize users into groups for better access control and collaboration
              </p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={fetchGroups} variant="outline" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </DialogTrigger>
                <DialogContent className={isDark ? "bg-gray-800 border-gray-700" : ""}>
                  <DialogHeader>
                    <DialogTitle>Create New Group</DialogTitle>
                    <DialogDescription>
                      Create a new group to organize users and manage permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="groupName" className="text-right">Name</Label>
                      <Input
                        id="groupName"
                        value={newGroupData.name}
                        onChange={(e) => setNewGroupData({...newGroupData, name: e.target.value})}
                        className="col-span-3"
                        placeholder="Enter group name"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label htmlFor="groupDescription" className="text-right mt-2">Description</Label>
                      <Textarea
                        id="groupDescription"
                        value={newGroupData.description}
                        onChange={(e) => setNewGroupData({...newGroupData, description: e.target.value})}
                        className="col-span-3"
                        placeholder="Describe the purpose of this group"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={handleCreateGroup} 
                      disabled={saving || !newGroupData.name.trim()}
                    >
                      {saving ? "Creating..." : "Create Group"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search */}
          <Card className={cn(
            "mb-6",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search groups by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "pl-10",
                    isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Groups Grid */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <Card className={cn(
                "md:col-span-2 xl:col-span-3",
                isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                <CardContent className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading groups...</p>
                </CardContent>
              </Card>
            ) : filteredGroups.length === 0 ? (
              <Card className={cn(
                "md:col-span-2 xl:col-span-3",
                isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                <CardContent className="text-center py-8">
                  <Building className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">
                    {searchTerm ? "No groups found matching your search." : "No groups created yet."}
                  </p>
                  {!searchTerm && (
                    <Button 
                      className="mt-4" 
                      onClick={() => setShowNewGroupDialog(true)}
                    >
                      Create Your First Group
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredGroups.map((group) => (
                <Card 
                  key={group.id}
                  className={cn(
                    "hover:shadow-md transition-shadow",
                    isDark ? "bg-gray-800 border-gray-700 hover:shadow-gray-700/10" : "bg-white border-gray-200 hover:shadow-gray-200/50"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-blue-900/20" : "bg-blue-50"
                        )}>
                          <UserCog className={cn(
                            "h-5 w-5",
                            isDark ? "text-blue-400" : "text-blue-600"
                          )} />
                        </div>
                        <div>
                          <CardTitle className={cn(
                            "text-lg",
                            isDark ? "text-white" : "text-gray-900"
                          )}>
                            {group.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {group.memberCount} members
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteGroup(group.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className={cn(
                      "text-sm mb-4",
                      isDark ? "text-gray-400" : "text-gray-600"
                    )}>
                      {group.description || "No description provided."}
                    </p>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                      <Button variant="outline" size="sm">
                        Manage Members
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Feature Notice */}
          <Card className={cn(
            "mt-8",
            isDark ? "bg-blue-900/10 border-blue-800" : "bg-blue-50 border-blue-200"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  isDark ? "bg-blue-900/20" : "bg-blue-100"
                )}>
                  <UserCog className={cn(
                    "h-5 w-5",
                    isDark ? "text-blue-400" : "text-blue-600"
                  )} />
                </div>
                <div>
                  <h3 className={cn(
                    "font-medium mb-1",
                    isDark ? "text-blue-200" : "text-blue-900"
                  )}>
                    Group Management Features
                  </h3>
                  <p className={cn(
                    "text-sm",
                    isDark ? "text-blue-300" : "text-blue-700"
                  )}>
                    This is a preview of the group management system. Full functionality includes:
                    role-based permissions, bulk user management, group-based data access controls,
                    and integration with existing security workflows.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}