"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Receipt, Clock, ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/currency";
import { useRouter } from "next/navigation";
import { useReceiptRealtime } from "@/hooks/useReceiptRealtime";

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  orderIndex: number;
  isSplitItem: boolean;
  claims: Array<{
    userId: string;
    userType: "user" | "placeholder";
    claimedAt: string;
    user: {
      id: string;
      name: string;
      email?: string;
      image?: string;
      isPlaceholder?: boolean;
    } | null;
  }>;
}

interface ReceiptSession {
  id: string;
  merchantName: string | null;
  receiptDate: string | null;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  status: string;
  participants: Array<{
    id: string;
    name: string;
    image: string | null;
    type: "user" | "placeholder";
  }>;
  expiresAt: string;
  createdAt: string;
}

interface ReceiptClaimingInterfaceProps {
  groupId: string;
  sessionId: string;
  groupCurrency: string;
  currentUserId: string;
}

export function ReceiptClaimingInterface({ 
  groupId, 
  sessionId, 
  groupCurrency, 
  currentUserId 
}: ReceiptClaimingInterfaceProps) {
  const router = useRouter();
  const [session, setSession] = useState<ReceiptSession | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingItems, setClaimingItems] = useState<Set<string>>(new Set());
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set());

  const fetchReceiptData = useCallback(async () => {
    try {
      console.log("Fetching receipt data for:", { groupId, sessionId });
      const response = await fetch(`/api/groups/${groupId}/receipts/${sessionId}`);
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API error:", errorData);
        
        if (response.status === 404) {
          toast.error("Receipt session not found");
          router.push(`/groups/${groupId}`);
          return;
        }
        if (response.status === 410) {
          toast.error("Receipt session has expired");
          router.push(`/groups/${groupId}`);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${errorData.error || 'Failed to fetch receipt data'}`);
      }

      const data = await response.json();
      console.log("Received data:", data);
      setSession(data.session);
      setItems(data.items);
    } catch (error) {
      console.error("Error fetching receipt data:", error);
      toast.error("Failed to load receipt data");
    } finally {
      setIsLoading(false);
    }
  }, [groupId, sessionId, router]);

  // Stable function for real-time updates that doesn't change on every render
  const handleRealtimeUpdate = useCallback(() => {
    fetchReceiptData();
  }, [fetchReceiptData]);

  const handleUserJoined = useCallback((userId: string) => {
    setActiveUsers(prev => new Set(prev).add(userId));
    // Remove user after 10 seconds if no activity
    setTimeout(() => {
      setActiveUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }, 10000);
  }, []);

  // Real-time connection
  const { isConnected } = useReceiptRealtime({
    groupId,
    sessionId,
    currentUserId,
    onUpdate: handleRealtimeUpdate,
    onUserJoined: handleUserJoined,
  });

  useEffect(() => {
    fetchReceiptData();
  }, [fetchReceiptData]);

  const handleItemClaim = async (itemId: string, action: "claim" | "unclaim") => {
    if (claimingItems.has(itemId)) return;

    console.log("Claiming item:", { itemId, action, groupId, sessionId });
    setClaimingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/groups/${groupId}/receipts/${sessionId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId, action }),
      });

      console.log("Claim response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Claim API error:", errorData);
        throw new Error(errorData.error || `Failed to ${action} item`);
      }

      const result = await response.json();
      console.log("Claim result:", result);

      // Always refresh the UI immediately after a successful claim
      // Real-time updates will also trigger this, but this ensures it works even if SSE fails
      await fetchReceiptData();
      
      toast.success(action === "claim" ? "Item claimed! 🎉" : "Item unclaimed");
      
    } catch (error) {
      console.error(`Error ${action}ing item:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} item`);
    } finally {
      setClaimingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleCreateExpense = async () => {
    if (!session) return;
    
    setCreatingExpense(true);
    
    try {
      const response = await fetch(`/api/groups/${groupId}/receipts/${sessionId}/create-expense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create expense');
      }

      await response.json();
      
      toast.success("Expense created successfully! 🎉");
      
      // Navigate back to group expenses
      router.push(`/groups/${groupId}`);
      
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create expense');
    } finally {
      setCreatingExpense(false);
    }
  };

  const isItemClaimedByCurrentUser = (item: ReceiptItem) => {
    return item.claims.some(claim => 
      claim.userId === currentUserId && claim.userType === "user"
    );
  };

  const calculateUserTotal = () => {
    let total = 0;
    items.forEach(item => {
      if (isItemClaimedByCurrentUser(item)) {
        const shareAmount = item.claims.length > 0 ? item.price / item.claims.length : 0;
        total += shareAmount;
      }
    });
    return total;
  };

  const calculateProgress = () => {
    const totalItems = items.length;
    const claimedItems = items.filter(item => item.claims.length > 0).length;
    return totalItems > 0 ? (claimedItems / totalItems) * 100 : 0;
  };

  const getUnclaimedItems = () => {
    return items.filter(item => item.claims.length === 0);
  };

  const calculateTotalWithTaxTip = () => {
    const unclaimedItems = getUnclaimedItems();
    const unclaimedTotal = unclaimedItems.reduce((sum, item) => sum + item.price, 0);
    const totalForUser = userTotal + (unclaimedTotal / (session?.participants?.length || 1));
    const taxTipMultiplier = session ? (session.tax + session.tip) / (session.subtotal || 1) : 0;
    return totalForUser + (totalForUser * taxTipMultiplier);
  };

  const getRemainingTime = () => {
    if (!session) return "Loading...";
    const now = new Date();
    const expires = new Date(session.expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load receipt session</p>
      </div>
    );
  }

  const userTotal = calculateUserTotal();
  const progress = calculateProgress();
  const unclaimedItems = getUnclaimedItems();
  const totalWithSplitting = calculateTotalWithTaxTip();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push(`/groups/${groupId}`)}
              className="p-2 min-h-[44px] min-w-[44px] shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="text-center flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate px-1">
                {session.merchantName || "Receipt Split"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {session.receiptDate 
                  ? new Date(session.receiptDate).toLocaleDateString()
                  : "Recent purchase"
                } • {formatAmount(session.total, groupCurrency)}
              </p>
            </div>
            
            {/* Mobile: Stack badges vertically, Desktop: Horizontal */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 shrink-0">
              <Badge 
                variant={isConnected ? "default" : "secondary"} 
                className="text-xs h-6 sm:h-auto"
              >
                {isConnected ? (
                  <Wifi className="h-3 w-3 mr-1" />
                ) : (
                  <WifiOff className="h-3 w-3 mr-1" />
                )}
                <span className="hidden sm:inline">{isConnected ? "Live" : "Offline"}</span>
                <span className="sm:hidden">{isConnected ? "🟢" : "🔴"}</span>
              </Badge>
              <Badge 
                variant={new Date(session.expiresAt) > new Date() ? "default" : "destructive"} 
                className="text-xs h-6 sm:h-auto"
              >
                <Clock className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">{getRemainingTime()}</span>
                <span className="sm:hidden">
                  {getRemainingTime().includes('h') 
                    ? getRemainingTime().split(' ')[0] 
                    : getRemainingTime().replace(' remaining', '')
                  }
                </span>
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Progress Section */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="text-center space-y-3 sm:space-y-4">
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-primary">
                  {items.filter(item => item.claims.length > 0).length}/{items.length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">items claimed</div>
              </div>
              <Progress value={progress} className="w-full h-2 sm:h-3" />
              <div className="text-xs sm:text-sm text-muted-foreground px-2">
                Tap items below to claim them • Multiple people can share items
              </div>
              
              {session && session.participants && session.participants.length > 0 && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                  <div className="text-xs sm:text-sm text-muted-foreground mb-2">Selected participants:</div>
                  <div className="flex -space-x-1 justify-center flex-wrap gap-y-2">
                    {session.participants.slice(0, 6).map((participant) => {
                      const isActive = activeUsers.has(participant.id);
                      const isCurrentUser = participant.id === currentUserId;
                      
                      return (
                        <div key={participant.id} className="relative">
                          <Avatar className={`h-7 w-7 sm:h-8 sm:w-8 border-2 ${
                            isCurrentUser 
                              ? 'border-blue-400' 
                              : isActive 
                                ? 'border-green-400' 
                                : 'border-white'
                          }`}>
                            {participant.image && participant.type === "user" && (
                              <AvatarImage src={participant.image} alt={participant.name} />
                            )}
                            <AvatarFallback className="text-xs">
                              {participant.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {/* Active indicator */}
                          {(isActive || isCurrentUser) && (
                            <div className={`absolute -top-1 -right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-white ${
                              isCurrentUser ? 'bg-blue-400' : 'bg-green-400'
                            }`} />
                          )}
                        </div>
                      );
                    })}
                    {session.participants.length > 6 && (
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">+{session.participants.length - 6}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-center text-muted-foreground mt-1 px-2">
                    {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''} in this bill
                    {activeUsers.size > 0 && (
                      <> • {activeUsers.size + 1} currently active</>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {items.map((item) => {
                const isClaimedByUser = isItemClaimedByCurrentUser(item);
                const isBeingClaimed = claimingItems.has(item.id);
                const sharePerPerson = item.claims.length > 0 ? item.price / item.claims.length : item.price;
                const totalClaimers = item.claims.length;

                return (
                  <div key={item.id} className={`p-4 sm:p-6 hover:bg-gray-50/50 transition-all duration-300 ${
                    totalClaimers > 0 ? 'bg-green-50/30' : ''
                  }`}>
                    {/* Mobile: Stack layout, Desktop: Side by side */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        {/* Mobile: Stack name and price, Desktop: Inline with price */}
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate">
                            {item.name}
                          </h3>
                          <div className="flex items-baseline gap-2 sm:gap-3">
                            <span className="text-lg sm:text-xl font-bold text-primary">
                              {formatAmount(item.price, groupCurrency)}
                            </span>
                            {totalClaimers > 0 && (
                              <span className="text-xs sm:text-sm text-gray-500 shrink-0">
                                ({formatAmount(sharePerPerson, groupCurrency)} each)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Claims Display */}
                        {totalClaimers > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex -space-x-1">
                              {item.claims.slice(0, 3).map((claim, index) => (
                                <Avatar key={index} className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-white">
                                  {claim.user?.image && !claim.user.isPlaceholder && (
                                    <AvatarImage src={claim.user.image} />
                                  )}
                                  <AvatarFallback className="text-xs">
                                    {claim.user?.name?.charAt(0).toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {totalClaimers > 3 && (
                                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-600">+{totalClaimers - 3}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs sm:text-sm text-gray-600 truncate">
                              {item.claims.map(claim => claim.user?.name || "Someone").slice(0, 2).join(", ")}
                              {totalClaimers > 2 && ` and ${totalClaimers - 2} more`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Button - Mobile: Full width, Desktop: Fixed width */}
                      <div className="flex-shrink-0 sm:w-auto">
                        <Button
                          onClick={() => {
                            if (!isBeingClaimed) {
                              handleItemClaim(item.id, isClaimedByUser ? "unclaim" : "claim");
                            }
                          }}
                          disabled={isBeingClaimed}
                          variant={isClaimedByUser ? "outline" : "default"}
                          size="sm"
                          className={`w-full sm:w-auto sm:min-w-[100px] min-h-[44px] ${
                            isClaimedByUser 
                              ? "border-green-300 text-green-700 hover:bg-green-50" 
                              : "bg-primary hover:bg-primary/90"
                          }`}
                        >
                          <span className="sm:hidden">
                            {isBeingClaimed ? (
                              "..."
                            ) : isClaimedByUser ? (
                              "Remove"
                            ) : (
                              "Add me"
                            )}
                          </span>
                          <span className="hidden sm:inline">
                            {isBeingClaimed ? (
                              "..."
                            ) : isClaimedByUser ? (
                              "Remove me"
                            ) : (
                              "Add me"
                            )}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Summary - Fixed Position with safe area support */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg safe-area-inset-bottom">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            {unclaimedItems.length > 0 && (
              <div className="text-xs text-center text-muted-foreground mb-2 sm:mb-3 px-1 sm:px-2">
                💡 {unclaimedItems.length} unclaimed item{unclaimedItems.length !== 1 ? 's' : ''} will be split among all {session?.participants?.length || 0} participants
              </div>
            )}
            
            {/* Mobile: Stack vertically, Desktop: Side by side */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="text-left sm:flex-1">
                <div className="text-xs sm:text-sm text-gray-600">Your total share</div>
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  {formatAmount(totalWithSplitting, groupCurrency)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatAmount(userTotal, groupCurrency)} claimed
                  {unclaimedItems.length > 0 && (
                    <> + {formatAmount(unclaimedItems.reduce((sum, item) => sum + item.price, 0) / (session?.participants?.length || 1), groupCurrency)} split</>
                  )}
                  {' + tax/tip'}
                </div>
              </div>
              
              <div className="sm:text-right">
                <Button 
                  size="lg"
                  onClick={handleCreateExpense}
                  disabled={creatingExpense || (userTotal === 0 && unclaimedItems.length === 0)}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 min-h-[48px] sm:min-h-[44px]"
                >
                  <span className="sm:hidden">
                    {creatingExpense ? (
                      <>Creating...</>
                    ) : userTotal === 0 && unclaimedItems.length === 0 ? (
                      "Claim Items First"
                    ) : (
                      "Create Expense"
                    )}
                  </span>
                  <span className="hidden sm:inline">
                    {creatingExpense ? (
                      <>Creating...</>
                    ) : userTotal === 0 && unclaimedItems.length === 0 ? (
                      "Claim Some Items"
                    ) : (
                      "Create Expense"
                    )}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Add padding to account for fixed bottom bar - larger on mobile for safe area */}
        <div className="h-32 sm:h-24"></div>
      </div>
    </div>
  );
}