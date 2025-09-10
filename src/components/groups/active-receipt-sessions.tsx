"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Receipt, Clock, Users, ArrowRight } from "lucide-react";
import { formatAmount } from "@/lib/currency";
import { useRouter } from "next/navigation";

interface ActiveSession {
  id: string;
  merchantName: string | null;
  receiptDate: string | null;
  totalAmount: string;
  status: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    image: string | null;
  };
}

interface ActiveReceiptSessionsProps {
  groupId: string;
  currency: string;
  currentUserId: string;
}

export function ActiveReceiptSessions({ 
  groupId, 
  currency,
  currentUserId 
}: ActiveReceiptSessionsProps) {
  const router = useRouter();
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/receipts/active`);
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(data.activeSessions || []);
      } else {
        console.error("Failed to fetch active sessions");
      }
    } catch (error) {
      console.error("Error fetching active sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchActiveSessions();
    
    // Poll for active sessions every 10 seconds
    const interval = setInterval(fetchActiveSessions, 10000);
    return () => clearInterval(interval);
  }, [groupId, fetchActiveSessions]);

  const joinSession = (sessionId: string) => {
    router.push(`/groups/${groupId}/receipts/${sessionId}`);
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m left`;
    }
    return `${minutes}m left`;
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-4 bg-muted rounded mb-2"></div>
          <div className="h-3 bg-muted rounded w-2/3"></div>
        </CardContent>
      </Card>
    );
  }

  if (activeSessions.length === 0) {
    return null; // Don't show anything if no active sessions
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Receipt className="h-4 w-4" />
        Active Receipt Sessions
      </div>
      {activeSessions.map((session) => {
        const isCreator = session.createdBy === currentUserId;
        
        return (
          <Card key={session.id} className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4">
              {/* Mobile-first layout */}
              <div className="space-y-3">
                {/* Header row with avatar and main info */}
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-10 w-10">
                      {session.creator.image && (
                        <AvatarImage src={session.creator.image} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {session.creator.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base leading-tight">
                          {session.merchantName || "Receipt Split"}
                        </h3>
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary flex-shrink-0">
                          <Users className="h-3 w-3 mr-1" />
                          Live
                        </Badge>
                      </div>
                      
                      {/* Amount - prominent on mobile */}
                      <div className="text-lg font-bold text-foreground flex-shrink-0">
                        {formatAmount(parseFloat(session.totalAmount), currency)}
                      </div>
                    </div>
                    
                    {/* Creator info */}
                    <div className="text-sm text-muted-foreground mb-1">
                      by {isCreator ? "You" : session.creator.name}
                    </div>
                  </div>
                </div>
                
                {/* Info row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{getTimeRemaining(session.expiresAt)}</span>
                  </div>
                  
                  <Button 
                    onClick={() => joinSession(session.id)}
                    className="flex-shrink-0"
                    size="default"
                  >
                    {isCreator ? "Continue" : "Join Split"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                
                {/* Description */}
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                  📱 {isCreator ? "Your" : `${session.creator.name}'s`} receipt is ready for claiming
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}