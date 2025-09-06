"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, TrendingUp, TrendingDown, Equal, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/currency";

interface Balance {
  userId: string;
  userName: string;
  userEmail: string;
  userImage?: string;
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

  const getBalanceIcon = (status: string) => {
    switch (status) {
      case 'owed':
        return <TrendingUp className="h-4 w-4" />;
      case 'owes':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Equal className="h-4 w-4" />;
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold">{formatCurrency(groupTotals.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calculator className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Average per Member</p>
                <p className="text-xl font-bold">{formatCurrency(groupTotals.averagePerMember)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Equal className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Settlement Status</p>
                <p className="text-xl font-bold">
                  {balances.every(b => Math.abs(b.netBalance) < 0.01) ? 'All Settled' : 'Pending'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
            <div className="space-y-4">
              {balances.map((balance, index) => {
                const status = getBalanceStatus(balance.netBalance);
                
                return (
                  <div key={balance.userId}>
                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={balance.userImage} />
                          <AvatarFallback>
                            {balance.userName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <h3 className="font-semibold">{balance.userName}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Paid: {formatCurrency(balance.totalPaid)}</span>
                            <span>•</span>
                            <span>Owes: {formatCurrency(balance.totalOwed)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`flex items-center gap-2 ${getBalanceColor(status)}`}>
                          {getBalanceIcon(status)}
                          <span className="font-semibold">
                            {status === 'settled' ? 'Settled' : formatCurrency(balance.netBalance)}
                          </span>
                        </div>
                        <Badge
                          variant={status === 'owed' ? 'default' : status === 'owes' ? 'destructive' : 'secondary'}
                          className="mt-1"
                        >
                          {status === 'owed' && 'Gets back'}
                          {status === 'owes' && 'Owes'}
                          {status === 'settled' && 'All settled'}
                        </Badge>
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

      {/* Balance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
              <p className="text-sm text-muted-foreground">Members who get back</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {balances.filter(b => b.netBalance > 0.01).length}
              </p>
            </div>
            
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <TrendingDown className="h-8 w-8 mx-auto text-red-600 dark:text-red-400 mb-2" />
              <p className="text-sm text-muted-foreground">Members who owe</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {balances.filter(b => b.netBalance < -0.01).length}
              </p>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Equal className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Members settled</p>
              <p className="text-2xl font-bold">
                {balances.filter(b => Math.abs(b.netBalance) < 0.01).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}