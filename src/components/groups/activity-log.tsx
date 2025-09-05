"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus, 
  UserMinus, 
  Users,
  Clock,
  Calendar
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ActivityItem {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface ActivityLogProps {
  groupId: string;
}

const getActivityIcon = (action: string) => {
  switch (action) {
    case 'expense_added':
      return <Plus className="h-4 w-4 text-green-600" />;
    case 'expense_edited':
      return <Edit className="h-4 w-4 text-blue-600" />;
    case 'expense_deleted':
      return <Trash2 className="h-4 w-4 text-red-600" />;
    case 'member_joined':
      return <UserPlus className="h-4 w-4 text-green-600" />;
    case 'member_left':
      return <UserMinus className="h-4 w-4 text-red-600" />;
    case 'group_created':
      return <Users className="h-4 w-4 text-blue-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const getActivityMessage = (activity: ActivityItem) => {
  let metadata;
  try {
    metadata = activity.metadata ? JSON.parse(activity.metadata) : {};
  } catch {
    metadata = {};
  }

  switch (activity.action) {
    case 'expense_added':
      return `added expense "${metadata.description || 'Unknown'}" for ${metadata.amount ? `$${metadata.amount}` : 'unknown amount'}`;
    case 'expense_edited':
      return `edited expense "${metadata.description || 'Unknown'}"`;
    case 'expense_deleted':
      return `deleted expense "${metadata.description || 'Unknown'}"`;
    case 'member_joined':
      return `joined the group`;
    case 'member_left':
      return `left the group`;
    case 'group_created':
      return `created the group`;
    default:
      return `performed action: ${activity.action}`;
  }
};

const getActivityColor = (action: string) => {
  switch (action) {
    case 'expense_added':
    case 'member_joined':
    case 'group_created':
      return 'border-l-green-500';
    case 'expense_edited':
      return 'border-l-blue-500';
    case 'expense_deleted':
    case 'member_left':
      return 'border-l-red-500';
    default:
      return 'border-l-gray-300';
  }
};

export function ActivityLog({ groupId }: ActivityLogProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/activity`);
      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }
      const data = await response.json();
      setActivities(data.activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast.error("Failed to load activity log");
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Group activities by date
  const groupActivitiesByDate = (activities: ActivityItem[]) => {
    const grouped: Record<string, ActivityItem[]> = {};
    
    activities.forEach(activity => {
      const date = new Date(activity.createdAt);
      const dateKey = date.toDateString();
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(activity);
    });
    
    return Object.entries(grouped).sort(([a], [b]) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
  };

  const isToday = (date: string) => {
    return new Date(date).toDateString() === new Date().toDateString();
  };

  const isYesterday = (date: string) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return new Date(date).toDateString() === yesterday.toDateString();
  };

  const formatDateHeader = (dateString: string) => {
    if (isToday(dateString)) return "Today";
    if (isYesterday(dateString)) return "Yesterday";
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-48"></div>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="rounded-full bg-muted h-8 w-8 mt-1"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Activity Log
          </h2>
          <p className="text-muted-foreground">
            {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'} in this group
          </p>
        </div>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
            <p className="text-muted-foreground">
              Group activity will appear here as members add expenses and interact with the group
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedActivities.map(([dateString, dateActivities]) => (
            <div key={dateString}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-lg">
                  {formatDateHeader(dateString)}
                </h3>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {/* Activities for this date */}
              <Card>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {dateActivities.map((activity, index) => (
                      <div key={activity.id}>
                        <div className={`p-4 border-l-4 ${getActivityColor(activity.action)}`}>
                          <div className="flex items-start space-x-3">
                            <Avatar className="h-8 w-8 mt-1">
                              <AvatarImage src={activity.user.image} />
                              <AvatarFallback className="text-xs">
                                {activity.user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getActivityIcon(activity.action)}
                                <p className="text-sm">
                                  <span className="font-medium">{activity.user.name}</span>
                                  <span className="text-muted-foreground ml-1">
                                    {getActivityMessage(activity)}
                                  </span>
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                </span>
                                <span>•</span>
                                <span>
                                  {new Date(activity.createdAt).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                            </div>

                            {activity.entityType && (
                              <Badge variant="outline" className="text-xs">
                                {activity.entityType}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {index < dateActivities.length - 1 && (
                          <Separator />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}