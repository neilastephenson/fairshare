"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Receipt, Clock, Wifi, Check, ChevronRight, Loader2 } from "lucide-react";
// import { toast } from "sonner";
import { formatAmount } from "@/lib/currency";

interface MockReceiptItem {
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
    };
  }>;
}

interface MockParticipant {
  id: string;
  name: string;
  image: string | null;
  type: "user" | "placeholder";
}

interface MockReceiptClaimingInterfaceProps {
  merchantName: string;
  itemCount: number;
  participantCount: number;
  groupCurrency?: string;
  currentUserId?: string;
}

export function MockReceiptClaimingInterface({
  merchantName,
  itemCount,
  participantCount,
  groupCurrency = "USD",
  currentUserId = "550e8400-e29b-41d4-a716-446655440003"
}: MockReceiptClaimingInterfaceProps) {
  const [items, setItems] = useState<MockReceiptItem[]>([]);
  const [participants, setParticipants] = useState<MockParticipant[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isCreatingExpense, setIsCreatingExpense] = useState(false);

  // Generate mock data
  useEffect(() => {
    const generateUUID = (seed: number) => {
      const hex = seed.toString(16).padStart(12, '0');
      return `550e8400-e29b-41d4-a716-${hex}`;
    };

    // Generate mock items
    const mockItems = Array.from({ length: itemCount }, (_, i) => ({
      id: generateUUID(1000 + i),
      name: `${["Burger", "Pizza", "Salad", "Pasta", "Sandwich", "Soup", "Tacos", "Sushi"][i % 8]} ${i + 1}`,
      price: Math.round((Math.random() * 20 + 5) * 100) / 100,
      orderIndex: i,
      isSplitItem: i % 3 === 0,
      claims: []
    }));

    // Generate mock participants
    const mockParticipants = Array.from({ length: participantCount }, (_, i) => ({
      id: i === 0 ? currentUserId : generateUUID(2000 + i),
      name: i === 0 ? "You" : `User ${i + 1}`,
      image: i === 0 ? null : `https://api.dicebear.com/7.x/avataaars/svg?seed=user${i + 1}`,
      type: (i === participantCount - 1 ? "placeholder" : "user") as "user" | "placeholder"
    }));

    setItems(mockItems);
    setParticipants(mockParticipants);
    
    // Set session expiry (30 minutes from now)
    const expiry = new Date(Date.now() + 30 * 60 * 1000);
    setSessionExpiry(expiry);

    // Simulate connection after a brief delay
    setTimeout(() => setIsConnected(true), 500);
  }, [itemCount, participantCount, currentUserId]);

  // Update time remaining
  useEffect(() => {
    if (!sessionExpiry) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = sessionExpiry.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiry]);

  // Simulate other users claiming items
  useEffect(() => {
    if (!isConnected || participants.length <= 1) return;

    const simulateClaim = () => {
      setItems(prevItems => {
        const unclaimedItems = prevItems.filter(item => item.claims.length === 0);
        if (unclaimedItems.length === 0) return prevItems;

        // Pick a random unclaimed item
        const randomItem = unclaimedItems[Math.floor(Math.random() * unclaimedItems.length)];
        
        // Pick a random participant (not the current user)
        const otherParticipants = participants.filter(p => p.id !== currentUserId);
        if (otherParticipants.length === 0) return prevItems;
        
        const randomParticipant = otherParticipants[Math.floor(Math.random() * otherParticipants.length)];

        return prevItems.map(item => {
          if (item.id === randomItem.id) {
            return {
              ...item,
              claims: [{
                userId: randomParticipant.id,
                userType: randomParticipant.type,
                claimedAt: new Date().toISOString(),
                user: {
                  id: randomParticipant.id,
                  name: randomParticipant.name,
                  image: randomParticipant.image || undefined,
                  isPlaceholder: randomParticipant.type === "placeholder"
                }
              }]
            };
          }
          return item;
        });
      });
    };

    // Simulate claims every 3-7 seconds
    const interval = setInterval(() => {
      if (Math.random() > 0.5) {
        simulateClaim();
      }
    }, Math.random() * 4000 + 3000);

    return () => clearInterval(interval);
  }, [isConnected, participants, currentUserId]);

  const toggleItemSelection = useCallback((itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Check if item is already claimed
    if (item.claims.length > 0) {
      const claimant = item.claims[0].user;
      if (claimant?.id !== currentUserId) {
        // toast.error(`Already claimed by ${claimant?.name || 'someone'}`);
        return;
      }
    }

    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, [items, currentUserId]);

  const handleClaimItems = useCallback(() => {
    if (selectedItems.size === 0) {
      // toast.error("Please select at least one item");
      return;
    }

    // Update items with claims
    setItems(prevItems => 
      prevItems.map(item => {
        if (selectedItems.has(item.id)) {
          return {
            ...item,
            claims: [{
              userId: currentUserId,
              userType: "user",
              claimedAt: new Date().toISOString(),
              user: {
                id: currentUserId,
                name: "You",
                email: "test@example.com",
                image: undefined,
                isPlaceholder: false
              }
            }]
          };
        }
        return item;
      })
    );

    // toast.success(`Claimed ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}`);
    setSelectedItems(new Set());
  }, [selectedItems, currentUserId]);

  const handleCreateExpense = useCallback(async () => {
    setIsCreatingExpense(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // toast.success("Test expense created successfully!");
    setIsCreatingExpense(false);
    
    // In real app, this would navigate to the expense
    console.log("Would navigate to expense page");
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * 0.08;
  const tip = subtotal * 0.15;
  const total = subtotal + tax + tip;

  const claimedItemsCount = items.filter(item => item.claims.length > 0).length;
  const progressPercentage = (claimedItemsCount / items.length) * 100;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Live session connected</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Connecting...</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{timeRemaining}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Claiming Progress</span>
            <span className="font-medium">{claimedItemsCount} of {items.length} items claimed</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </CardContent>
      </Card>

      {/* Receipt Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">{merchantName}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString()} • {participants.length} participants
              </p>
            </div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatAmount(subtotal, groupCurrency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatAmount(tax, groupCurrency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tip</span>
              <span>{formatAmount(tip, groupCurrency)}</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Total</span>
              <span>{formatAmount(total, groupCurrency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-3">
        <h3 className="font-medium">Receipt Items</h3>
        {items.map((item) => {
          const isClaimed = item.claims.length > 0;
          const claimedByCurrentUser = item.claims.some(c => c.userId === currentUserId);
          const isSelected = selectedItems.has(item.id);
          
          return (
            <Card
              key={item.id}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary' : ''
              } ${isClaimed && !claimedByCurrentUser ? 'opacity-60' : ''}`}
              onClick={() => toggleItemSelection(item.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatAmount(item.price, groupCurrency)}
                        {item.isSplitItem && (
                          <Badge variant="outline" className="ml-2 text-xs">Split Item</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {isClaimed && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {item.claims[0].user?.image && (
                          <AvatarImage src={item.claims[0].user.image} />
                        )}
                        <AvatarFallback className="text-xs">
                          {item.claims[0].user?.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        {item.claims[0].user?.name || 'Unknown'}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-background pt-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setSelectedItems(new Set())}
          disabled={selectedItems.size === 0}
        >
          Clear Selection
        </Button>
        <Button
          className="flex-1"
          onClick={handleClaimItems}
          disabled={selectedItems.size === 0}
        >
          Claim {selectedItems.size > 0 && `(${selectedItems.size})`}
        </Button>
      </div>

      {/* Create Expense Button (shown when all items are claimed) */}
      {claimedItemsCount === items.length && items.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="font-medium text-green-900 dark:text-green-100">All items claimed!</h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Ready to create the group expense
                </p>
              </div>
              <Button 
                onClick={handleCreateExpense}
                disabled={isCreatingExpense}
                className="w-full"
              >
                {isCreatingExpense ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Expense...
                  </>
                ) : (
                  <>
                    Create Group Expense
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}