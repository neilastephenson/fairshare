"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, ArrowRight, CheckCircle, Eye, DollarSign, Check, History, Undo2 } from "lucide-react";
// import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAmount } from "@/lib/currency";

interface SettlementTransaction {
  id?: string;
  from: {
    id: string;
    name: string;
    email: string | null;
    image?: string | null;
    type?: "user" | "placeholder";
    paymentInfo?: string | null;
  };
  to: {
    id: string;
    name: string;
    email: string | null;
    image?: string | null;
    type?: "user" | "placeholder";
    paymentInfo?: string | null;
  };
  amount: number;
  settledAt?: string;
}

interface SettleUpViewProps {
  groupId: string;
  currency?: string;
}

export function SettleUpView({ groupId, currency = "GBP" }: SettleUpViewProps) {
  const [settlements, setSettlements] = useState<SettlementTransaction[]>([]);
  const [settledPayments, setSettledPayments] = useState<SettlementTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserPaymentInfo, setSelectedUserPaymentInfo] = useState<string | null>(null);
  const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [markingUnpaid, setMarkingUnpaid] = useState<string | null>(null);

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
      // toast.error("Failed to load settlement suggestions");
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

  const viewPaymentInfo = (transaction: SettlementTransaction) => {
    // Use the payment info from the transaction data (fetched from the API)
    const paymentInfo = transaction.to.paymentInfo;
    
    setSelectedUserPaymentInfo(paymentInfo || null);
    setIsPaymentInfoOpen(true);
  };

  const markAsPaid = async (transaction: SettlementTransaction, index: number) => {
    const transactionId = transaction.id || `${transaction.from.id}-${transaction.to.id}-${transaction.amount}`;
    setMarkingPaid(transactionId);
    
    try {
      // In a real app, this would call an API to mark the settlement as paid
      // and update the group balances
      const response = await fetch(`/api/groups/${groupId}/settlements/${transactionId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Move transaction from pending to settled
        const settledTransaction = {
          ...transaction,
          id: transactionId,
          settledAt: new Date().toISOString(),
        };
        
        setSettlements(prev => prev.filter((_, i) => i !== index));
        setSettledPayments(prev => [settledTransaction, ...prev]);
        
        // toast.success(`Payment of ${formatCurrency(transaction.amount)} marked as paid!`);
      } else {
        throw new Error('Failed to mark payment as paid');
      }
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      // toast.error('Failed to mark payment as paid. Please try again.');
    } finally {
      setMarkingPaid(null);
    }
  };

  const markAsUnpaid = async (transaction: SettlementTransaction, index: number) => {
    const transactionId = transaction.id || `${transaction.from.id}-${transaction.to.id}-${transaction.amount}`;
    setMarkingUnpaid(transactionId);
    
    try {
      // In a real app, this would call an API to mark the settlement as unpaid
      // and restore it to the pending settlements list
      const response = await fetch(`/api/groups/${groupId}/settlements/${transactionId}/mark-unpaid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Move transaction from settled back to pending
        const pendingTransaction = {
          from: transaction.from,
          to: transaction.to,
          amount: transaction.amount,
          id: transaction.id,
        };
        
        setSettledPayments(prev => prev.filter((_, i) => i !== index));
        setSettlements(prev => [pendingTransaction, ...prev]);
        
        // toast.success(`Payment of ${formatCurrency(transaction.amount)} marked as unpaid`);
      } else {
        throw new Error('Failed to mark payment as unpaid');
      }
    } catch (error) {
      console.error('Error marking payment as unpaid:', error);
      // toast.error('Failed to mark payment as unpaid. Please try again.');
    } finally {
      setMarkingUnpaid(null);
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
              ? settledPayments.length > 0 
                ? "All pending settlements completed!"
                : "All balances are settled!"
              : `${settlements.length} transaction${settlements.length !== 1 ? 's' : ''} needed to settle remaining debts`
            }
          </p>
        </div>
      </div>

      {/* Settlement Optimization Info */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Optimized to minimize transactions needed to settle all debts
        </p>
      </div>

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
                    <div className="flex items-center space-x-4 w-full sm:min-w-0 sm:flex-1">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {transaction.from.image && (
                          <AvatarImage src={transaction.from.image} />
                        )}
                        <AvatarFallback>
                          {transaction.from.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {transaction.from.name}
                          {transaction.from.type === 'placeholder' && (
                            <Badge variant="outline" className="ml-2 text-xs">Pending</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground break-all overflow-wrap-anywhere">
                          {transaction.from.type === 'placeholder' ? 'Waiting to join' : transaction.from.email}
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
                    <div className="flex items-center w-full sm:min-w-0 sm:flex-1 sm:justify-end">
                      {/* Mobile: Same layout as From User, Desktop: Reverse order */}
                      <Avatar className="h-10 w-10 flex-shrink-0 sm:order-2">
                        {transaction.to.image && (
                          <AvatarImage src={transaction.to.image} />
                        )}
                        <AvatarFallback>
                          {transaction.to.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 ml-4 text-left sm:text-right sm:order-1 sm:ml-0 sm:mr-4">
                        <p className="font-medium truncate">
                          {transaction.to.name}
                          {transaction.to.type === 'placeholder' && (
                            <Badge variant="outline" className="ml-2 text-xs">Pending</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground break-all overflow-wrap-anywhere">
                          {transaction.to.type === 'placeholder' ? 'Waiting to join' : transaction.to.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-center gap-2 mt-3">
                    {transaction.to.type !== 'placeholder' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewPaymentInfo(transaction)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View Payment Info
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => markAsPaid(transaction, index)}
                      disabled={markingPaid === (transaction.id || `${transaction.from.id}-${transaction.to.id}-${transaction.amount}`)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {markingPaid === (transaction.id || `${transaction.from.id}-${transaction.to.id}-${transaction.amount}`) ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Marking...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Mark As Paid
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

      {/* Settled Payments */}
      {settledPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-green-600" />
              Settled Payments
            </CardTitle>
            <CardDescription>
              Payments that have been marked as completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settledPayments.map((transaction, index) => (
                <div key={`settled-${index}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 space-y-4 sm:space-y-0">
                    {/* From User */}
                    <div className="flex items-center space-x-4 w-full sm:min-w-0 sm:flex-1">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {transaction.from.image && (
                          <AvatarImage src={transaction.from.image} />
                        )}
                        <AvatarFallback>
                          {transaction.from.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {transaction.from.name}
                          {transaction.from.type === 'placeholder' && (
                            <Badge variant="outline" className="ml-2 text-xs">Pending</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground break-all overflow-wrap-anywhere">
                          {transaction.from.type === 'placeholder' ? 'Waiting to join' : transaction.from.email}
                        </p>
                      </div>
                    </div>

                    {/* Arrow and Amount */}
                    <div className="flex items-center justify-center w-full sm:w-auto sm:flex-shrink-0 sm:mx-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                          <span className="text-sm">paid</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                        <Badge variant="outline" className="mt-1 font-semibold text-lg px-3 py-1 whitespace-nowrap border-green-600 text-green-700 dark:text-green-400">
                          {formatCurrency(transaction.amount)}
                        </Badge>
                      </div>
                    </div>

                    {/* To User */}
                    <div className="flex items-center w-full sm:min-w-0 sm:flex-1 sm:justify-end">
                      <Avatar className="h-10 w-10 flex-shrink-0 sm:order-2">
                        {transaction.to.image && (
                          <AvatarImage src={transaction.to.image} />
                        )}
                        <AvatarFallback>
                          {transaction.to.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 ml-4 text-left sm:text-right sm:order-1 sm:ml-0 sm:mr-4">
                        <p className="font-medium truncate">
                          {transaction.to.name}
                          {transaction.to.type === 'placeholder' && (
                            <Badge variant="outline" className="ml-2 text-xs">Pending</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground break-all overflow-wrap-anywhere">
                          {transaction.to.type === 'placeholder' ? 'Waiting to join' : transaction.to.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Settled Info and Actions */}
                  <div className="flex justify-center items-center gap-4 mt-2">
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        Settled {transaction.settledAt ? new Date(transaction.settledAt).toLocaleDateString() : 'recently'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsUnpaid(transaction, index)}
                      disabled={markingUnpaid === (transaction.id || `${transaction.from.id}-${transaction.to.id}-${transaction.amount}`)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                    >
                      {markingUnpaid === (transaction.id || `${transaction.from.id}-${transaction.to.id}-${transaction.amount}`) ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                          Unmarking...
                        </>
                      ) : (
                        <>
                          <Undo2 className="h-3 w-3 mr-1" />
                          Mark as Unpaid
                        </>
                      )}
                    </Button>
                  </div>

                  {index < settledPayments.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Info Dialog */}
      <Dialog open={isPaymentInfoOpen} onOpenChange={setIsPaymentInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Information
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUserPaymentInfo ? (
              <div className="p-4 bg-muted/20 border rounded-lg">
                <p className="whitespace-pre-wrap text-sm">{selectedUserPaymentInfo}</p>
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No payment details provided yet</p>
                <p className="text-xs text-muted-foreground">
                  This user hasn&apos;t added their payment information to their profile
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}