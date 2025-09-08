"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, MoreHorizontal, Shield, UserMinus, Crown, UserCheck, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { AddPlaceholderDialog } from "./add-placeholder-dialog";

interface Member {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: string;
  joinedAt: string;
}

interface PlaceholderUser {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  claimedBy?: string;
  claimedAt?: string;
}

interface MemberListProps {
  groupId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export function MemberList({ groupId, currentUserId, isAdmin }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [placeholders, setPlaceholders] = useState<PlaceholderUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    try {
      const [membersResponse, placeholdersResponse] = await Promise.all([
        fetch(`/api/groups/${groupId}/members`),
        fetch(`/api/groups/${groupId}/placeholder-users`),
      ]);
      
      if (!membersResponse.ok) {
        throw new Error("Failed to fetch members");
      }
      if (!placeholdersResponse.ok) {
        throw new Error("Failed to fetch placeholder users");
      }
      
      const membersData = await membersResponse.json();
      const placeholdersData = await placeholdersResponse.json();
      
      setMembers(membersData.members);
      setPlaceholders(placeholdersData.placeholderUsers);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load members");
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update member role");
      }

      toast.success(`Member role updated to ${newRole}`);
      fetchMembers();
    } catch (error) {
      console.error("Error updating member role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update member role");
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      toast.success("Member removed from group");
      fetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    }
  };

  const removePlaceholder = async (placeholderId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/placeholder-users/${placeholderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove placeholder user");
      }

      toast.success("Placeholder user removed");
      fetchMembers();
    } catch (error) {
      console.error("Error removing placeholder user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove placeholder user");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="rounded-full bg-muted h-12 w-12"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-32"></div>
                    <div className="h-3 bg-muted rounded w-24"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Members
          </h2>
          <p className="text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''}
            {placeholders.filter(p => !p.claimedBy).length > 0 && ` and ${placeholders.filter(p => !p.claimedBy).length} placeholder${placeholders.filter(p => !p.claimedBy).length !== 1 ? 's' : ''}`} in this group
          </p>
        </div>
        {isAdmin && (
          <AddPlaceholderDialog
            groupId={groupId}
            onPlaceholderAdded={fetchMembers}
          />
        )}
      </div>

      {/* Members and Placeholders List */}
      <div className="space-y-4">
        {/* Placeholder Users */}
        {placeholders.filter(placeholder => !placeholder.claimedBy).map((placeholder) => (
          <Card key={`placeholder-${placeholder.id}`} className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12 bg-muted">
                    <AvatarFallback className="bg-muted">
                      {placeholder.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{placeholder.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        Placeholder
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Waiting to join the group</p>
                    {placeholder.claimedBy ? (
                      <p className="text-xs text-muted-foreground">
                        Claimed {formatDistanceToNow(new Date(placeholder.claimedAt!), { addSuffix: true })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Created {formatDistanceToNow(new Date(placeholder.createdAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {placeholder.claimedBy && (
                    <Badge variant="outline" className="text-xs">
                      <UserCheck className="h-3 w-3 mr-1" />
                      Claimed
                    </Badge>
                  )}

                  {/* Action Menu (only for admins) */}
                  {isAdmin && !placeholder.claimedBy && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => removePlaceholder(placeholder.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Placeholder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Regular Members */}
        {members.map((member) => (
          <Card key={member.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.image} />
                    <AvatarFallback>
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{member.name}</h3>
                      {member.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Show crown icon only on mobile for admin, full badge on desktop */}
                  {member.role === 'admin' && (
                    <>
                      {/* Mobile: Just crown icon */}
                      <div className="md:hidden">
                        <Crown className="h-4 w-4 text-primary" />
                      </div>
                      {/* Desktop: Full badge */}
                      <Badge variant="default" className="hidden md:flex">
                        <Crown className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    </>
                  )}

                  {/* Action Menu (only for admins, not for current user) */}
                  {isAdmin && member.id !== currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role === 'member' ? (
                          <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'admin')}>
                            <Shield className="h-4 w-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'member')}>
                            <Users className="h-4 w-4 mr-2" />
                            Remove Admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => removeMember(member.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {members.length === 0 && placeholders.filter(p => !p.claimedBy).length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No members found</h3>
            <p className="text-muted-foreground">
              There are no members in this group yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}