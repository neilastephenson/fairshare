"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/currency";

interface Balance {
  userId: string;
  userName: string;
  userEmail: string | null;
  userImage?: string | null;
  userType?: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = owed money, negative = owes money
}

interface BalanceViewProps {
  groupId: string;
  currency?: string;
}

export function BalanceView({ groupId, currency = "GBP" }: BalanceViewProps) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupTotals, setGroupTotals] = useState({
    totalExpenses: 0,
    totalMembers: 0,
    totalPlaceholders: 0,
    totalParticipants: 0,
    averagePerMember: 0,
  });

  const fetchBalances = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/balances`);
      if (!response.ok) {
        throw new Error("Failed to fetch balances");
      }
      const data = await response.json();
      setBalances(data.balances);
      setGroupTotals(data.totals);
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast.error("Failed to load balances");
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const formatCurrency = (amount: number) => {
    return formatAmount(Math.abs(amount), currency);
  };

  const getBalanceStatus = (netBalance: number) => {
    if (netBalance > 0.01) return 'owed'; // They are owed money
    if (netBalance < -0.01) return 'owes'; // They owe money
    return 'settled'; // Even
  };

  const getBalanceColor = (status: string) => {
    switch (status) {
      case 'owed':
        return 'text-green-600 dark:text-green-400';
      case 'owes':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };


  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-48"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="rounded-full bg-muted h-12 w-12"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-3 bg-muted rounded w-24"></div>
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

  return (
    <div className="space-y-6">
      {/* Header with Totals */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-xl font-bold truncate">{formatCurrency(groupTotals.totalExpenses)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Per Person</p>
                  <p className="text-xl font-bold truncate">{formatCurrency(groupTotals.averagePerMember)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Individual Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Member Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <div className="text-center py-8">
              <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No expenses yet</h3>
              <p className="text-muted-foreground">
                Add some expenses to see the balance breakdown
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map((balance, index) => {
                const status = getBalanceStatus(balance.netBalance);
                
                return (
                  <div key={balance.userId}>
                    <div className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            {balance.userImage && (
                              <AvatarImage src={balance.userImage} />
                            )}
                            <AvatarFallback>
                              {balance.userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">
                              {balance.userName}
                              {balance.userType === 'placeholder' && (
                                <Badge variant="outline" className="ml-2 text-xs">Pending</Badge>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Paid {formatCurrency(balance.totalPaid)} • Owes {formatCurrency(balance.totalOwed)}
                            </p>
                          </div>
                        </div>

                        {/* Balance info */}
                        <div className="text-right">
                          <div className={`font-semibold ${getBalanceColor(status)}`}>
                            {status === 'settled' ? 'Settled' : (
                              status === 'owed' ? `+${formatCurrency(balance.netBalance)}` : `-${formatCurrency(balance.netBalance)}`
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {status === 'owed' && 'Gets back'}
                            {status === 'owes' && 'Owes'}
                            {status === 'settled' && 'All even'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {index < balances.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}