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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Eye,
  UserCheck,
  UserX,
  RefreshCw
} from "lucide-react";
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const roleColors = {
  'ADMIN': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  'ANALYST': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', 
  'VIEWER': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  'BU_LEAD': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
};

export default function UserManagementPage() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // New user dialog state
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    role: 'VIEWER' as const,
    firstName: '',
    lastName: '',
    department: ''
  });
  const [saving, setSaving] = useState(false);
  
  // Edit user dialog state
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserData, setEditUserData] = useState({
    role: 'VIEWER' as const,
    firstName: '',
    lastName: '',
    department: ''
  });

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
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    console.log('Fetching users...');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      console.log('Fetch users response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched users:', data);
        setUsers(data);
      } else {
        const error = await response.json();
        console.error('Error fetching users:', error);
        alert(`Failed to fetch users: ${error.error}`);
      }
    } catch (error) {
      console.error('Network error fetching users:', error);
      alert('Network error while fetching users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" || 
      (statusFilter === "ACTIVE" ? user.active : !user.active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateUser = async () => {
    console.log('Creating user with data:', newUserData);
    setSaving(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData)
      });

      console.log('Create user response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('User created successfully:', result);
        await fetchUsers();
        setShowNewUserDialog(false);
        setNewUserData({
          email: '',
          role: 'VIEWER',
          firstName: '',
          lastName: '',
          department: ''
        });
        alert(`User created successfully! ${result.temporaryPassword ? `Temporary password: ${result.temporaryPassword}` : ''}`);
      } else {
        const error = await response.json();
        console.error('Error response:', error);
        alert(`Error creating user: ${error.error}`);
      }
    } catch (error) {
      console.error('Network error creating user:', error);
      alert(`Failed to create user: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentStatus })
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        const error = await response.json();
        alert(`Failed to update user status: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Network error updating user status');
    }
  };
  
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserData({
      role: user.role as any,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      department: user.department || ''
    });
    setShowEditUserDialog(true);
  };
  
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUserData)
      });

      if (response.ok) {
        await fetchUsers();
        setShowEditUserDialog(false);
        setEditingUser(null);
        alert('User updated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to update user: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Network error updating user');
    } finally {
      setSaving(false);
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
              )}>User Management</h1>
              <p className={cn(
                "mt-1",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                Manage user accounts and permissions
              </p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={fetchUsers} variant="outline" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className={isDark ? "bg-gray-800 border-gray-700" : ""}>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user to the system. They will receive login credentials via email.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="email" className="text-right">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                        className="col-span-3"
                        placeholder="user@company.com"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="role" className="text-right">Role</Label>
                      <Select value={newUserData.role} onValueChange={(value: any) => setNewUserData({...newUserData, role: value})}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                          <SelectItem value="ANALYST">Analyst</SelectItem>
                          <SelectItem value="BU_LEAD">Business Unit Lead</SelectItem>
                          <SelectItem value="ADMIN">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="firstName" className="text-right">First Name</Label>
                      <Input
                        id="firstName"
                        value={newUserData.firstName}
                        onChange={(e) => setNewUserData({...newUserData, firstName: e.target.value})}
                        className="col-span-3"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="lastName" className="text-right">Last Name</Label>
                      <Input
                        id="lastName"
                        value={newUserData.lastName}
                        onChange={(e) => setNewUserData({...newUserData, lastName: e.target.value})}
                        className="col-span-3"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="department" className="text-right">Department</Label>
                      <Input
                        id="department"
                        value={newUserData.department}
                        onChange={(e) => setNewUserData({...newUserData, department: e.target.value})}
                        className="col-span-3"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={handleCreateUser} 
                      disabled={saving || !newUserData.email}
                    >
                      {saving ? "Creating..." : "Create User"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Edit User Dialog */}
              <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
                <DialogContent className={isDark ? "bg-gray-800 border-gray-700" : ""}>
                  <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>
                      Update user information and permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Email</Label>
                      <Input
                        value={editingUser?.email || ''}
                        disabled
                        className="col-span-3 opacity-50"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editRole" className="text-right">Role</Label>
                      <Select value={editUserData.role} onValueChange={(value: any) => setEditUserData({...editUserData, role: value})}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                          <SelectItem value="ANALYST">Analyst</SelectItem>
                          <SelectItem value="BU_LEAD">Business Unit Lead</SelectItem>
                          <SelectItem value="ADMIN">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editFirstName" className="text-right">First Name</Label>
                      <Input
                        id="editFirstName"
                        value={editUserData.firstName}
                        onChange={(e) => setEditUserData({...editUserData, firstName: e.target.value})}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editLastName" className="text-right">Last Name</Label>
                      <Input
                        id="editLastName"
                        value={editUserData.lastName}
                        onChange={(e) => setEditUserData({...editUserData, lastName: e.target.value})}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="editDepartment" className="text-right">Department</Label>
                      <Input
                        id="editDepartment"
                        value={editUserData.department}
                        onChange={(e) => setEditUserData({...editUserData, department: e.target.value})}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={handleUpdateUser} 
                      disabled={saving}
                    >
                      {saving ? "Updating..." : "Update User"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filters */}
          <Card className={cn(
            "mb-6",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users by email, name, or department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn(
                        "pl-10",
                        isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                      )}
                    />
                  </div>
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className={cn(
                    "w-32",
                    isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Roles</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="ANALYST">Analyst</SelectItem>
                    <SelectItem value="BU_LEAD">BU Lead</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={cn(
                    "w-32",
                    isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className={cn(
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                isDark ? "text-white" : "text-gray-900"
              )}>
                <Users className="h-5 w-5" />
                Users ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading users...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border",
                        isDark ? "bg-gray-750 border-gray-600" : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarFallback className={cn(
                            isDark ? "bg-gray-700" : "bg-gray-300"
                          )}>
                            {user.firstName?.[0] || user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={cn(
                              "font-medium",
                              isDark ? "text-white" : "text-gray-900"
                            )}>
                              {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0]}
                            </h3>
                            <Badge className={roleColors[user.role as keyof typeof roleColors]}>
                              {user.role}
                            </Badge>
                            {!user.active && (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className={cn(
                            "text-sm",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}>
                            {user.email}
                          </p>
                          {user.department && (
                            <p className={cn(
                              "text-xs",
                              isDark ? "text-gray-500" : "text-gray-400"
                            )}>
                              {user.department}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatus(user.id, user.active)}
                        >
                          {user.active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && !loading && (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">No users found matching your criteria.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}