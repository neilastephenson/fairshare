"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, ArrowRight, CheckCircle, Copy, DollarSign, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/currency";

interface SettlementTransaction {
  from: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  to: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  amount: number;
}

interface SettleUpViewProps {
  groupId: string;
  currency?: string;
}

export function SettleUpView({ groupId, currency = "GBP" }: SettleUpViewProps) {
  const [settlements, setSettlements] = useState<SettlementTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchSettlements = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/settlements`);
      if (!response.ok) {
        throw new Error("Failed to fetch settlements");
      }
      const data = await response.json();
      setSettlements(data.settlements);
    } catch (error) {
      console.error("Error fetching settlements:", error);
      toast.error("Failed to load settlement suggestions");
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const formatCurrency = (amount: number) => {
    return formatAmount(amount, currency);
  };

  const generatePaymentInstruction = (transaction: SettlementTransaction) => {
    return `${transaction.from.name} owes ${transaction.to.name} ${formatCurrency(transaction.amount)} for group expenses`;
  };

  const copyPaymentInstruction = async (transaction: SettlementTransaction, index: number) => {
    try {
      const instruction = generatePaymentInstruction(transaction);
      await navigator.clipboard.writeText(instruction);
      setCopiedIndex(index);
      toast.success("Payment instruction copied!");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error("Failed to copy payment instruction");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-48"></div>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="rounded-full bg-muted h-10 w-10"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                    </div>
                    <div className="rounded-full bg-muted h-10 w-10"></div>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Settle Up
          </h2>
          <p className="text-muted-foreground">
            {settlements.length === 0 
              ? "All balances are settled!"
              : `${settlements.length} transaction${settlements.length !== 1 ? 's' : ''} needed to settle all debts`
            }
          </p>
        </div>
      </div>

      {/* Settlement Optimization Info */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Optimized Settlement Plan
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                This plan minimizes the number of transactions needed to settle all debts in your group.
                Each person only needs to make or receive a few payments instead of individual settlements with everyone.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {settlements.length === 0 ? (
        /* All Settled */
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">All Settled Up! 🎉</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Congratulations! All expenses have been settled and everyone is even.
              No payments need to be made.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Settlement Transactions */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Required Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settlements.map((transaction, index) => (
                <div key={index}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-card space-y-4 sm:space-y-0">
                    {/* From User */}
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={transaction.from.image} />
                        <AvatarFallback>
                          {transaction.from.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{transaction.from.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {transaction.from.email}
                        </p>
                      </div>
                    </div>

                    {/* Arrow and Amount */}
                    <div className="flex items-center justify-center w-full sm:w-auto sm:flex-shrink-0 sm:mx-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                          <span className="text-sm">pays</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                        <Badge variant="outline" className="mt-1 font-semibold text-lg px-3 py-1 whitespace-nowrap">
                          {formatCurrency(transaction.amount)}
                        </Badge>
                      </div>
                    </div>

                    {/* To User */}
                    <div className="flex items-center space-x-3 min-w-0 flex-1 sm:justify-end">
                      <div className="text-left sm:text-right min-w-0 flex-1 sm:flex-initial order-2 sm:order-1">
                        <p className="font-medium truncate">{transaction.to.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {transaction.to.email}
                        </p>
                      </div>
                      <Avatar className="h-10 w-10 flex-shrink-0 order-1 sm:order-2">
                        <AvatarImage src={transaction.to.image} />
                        <AvatarFallback>
                          {transaction.to.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-center mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyPaymentInstruction(transaction, index)}
                      className="flex items-center gap-2"
                    >
                      {copiedIndex === index ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Payment Info
                        </>
                      )}
                    </Button>
                  </div>

                  {index < settlements.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods Info */}
      {settlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Popular Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold mb-2">Venmo</div>
                <p className="text-sm text-muted-foreground">
                  Quick mobile payments between friends
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold mb-2">PayPal</div>
                <p className="text-sm text-muted-foreground">
                  Secure online payments worldwide
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg sm:col-span-2 lg:col-span-1">
                <div className="font-semibold mb-2">Cash App</div>
                <p className="text-sm text-muted-foreground">
                  Instant transfers with just a phone number
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                💡 Tip: Use the &quot;Copy Payment Info&quot; button to easily share payment details with group members
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}