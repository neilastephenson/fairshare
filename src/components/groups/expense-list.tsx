"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// Removed unused Separator import
import { AddExpenseDialog } from "./add-expense-dialog";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { Receipt, Plus, Trash2, Calendar, User, Edit, LayoutGrid, List } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { formatAmount } from "@/lib/currency";
import { useSession } from "@/lib/auth-client";

interface Expense {
  id: string;
  amount: string;
  description: string;
  category?: string;
  date: string;
  createdAt: string;
  paidBy: {
    id: string;
    name: string;
    email: string | null;
    image?: string | null;
    isPlaceholder?: boolean;
  };
  participants: Array<{
    userId: string;
    userType: string;
    shareAmount: string;
    user: {
      id: string;
      name: string;
      email: string | null;
      image?: string | null;
      isPlaceholder?: boolean;
    };
  }>;
}

interface Member {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface PlaceholderUser {
  id: string;
  name: string;
  createdAt: string;
  claimedBy?: string;
}

interface Participant {
  id: string;
  name: string;
  email?: string;
  image?: string;
  type: "user" | "placeholder";
}

interface ExpenseListProps {
  groupId: string;
  currency?: string;
}

export function ExpenseList({ groupId, currency = "GBP" }: ExpenseListProps) {
  const { data: session } = useSession();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');

  // Helper function to format names with surname initial for compact display
  const formatNameCompact = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length <= 1) return name; // Single name, return as is
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName} ${lastName.charAt(0)}.`;
  };

  // Helper function to get current user's net balance for an expense
  const getCurrentUserBalance = (expense: Expense) => {
    if (!session?.user) return null;
    
    // Check if user paid for this expense
    const userPaid = expense.paidBy.id === session.user.id && !expense.paidBy.isPlaceholder;
    const amountPaid = userPaid ? Number(expense.amount) : 0;
    
    // Check if user is a participant and their share
    const userParticipant = expense.participants.find(
      p => p.userId === session.user.id && p.userType === 'user'
    );
    const userShare = userParticipant ? Number(userParticipant.shareAmount) : 0;
    
    // If user is not involved at all (didn't pay and not a participant)
    if (!userPaid && !userParticipant) {
      return { type: 'not_involved', amount: 0 };
    }
    
    // Calculate net balance: what they paid minus what they owe
    const netBalance = amountPaid - userShare;
    
    if (netBalance > 0.01) {
      return { type: 'owed', amount: netBalance }; // They are owed money (green)
    } else if (netBalance < -0.01) {
      return { type: 'owes', amount: Math.abs(netBalance) }; // They owe money (red)
    } else {
      return { type: 'settled', amount: 0 }; // Even (grey)
    }
  };

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/expenses`);
      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }
      const data = await response.json();
      setExpenses(data.expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast.error("Failed to load expenses");
    }
  }, [groupId]);

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
      
      // Combine members and unclaimed placeholders into participants
      // Filter out claimed placeholders as they're now represented by actual users
      const unclaimedPlaceholders = (placeholdersData.placeholderUsers || []).filter(
        (p: PlaceholderUser) => !p.claimedBy
      );
      
      const allParticipants: Participant[] = [
        ...membersData.members.map((m: Member) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          image: m.image,
          type: "user" as const,
        })),
        ...unclaimedPlaceholders.map((p: PlaceholderUser) => ({
          id: p.id,
          name: p.name,
          type: "placeholder" as const,
        })),
      ];
      
      setParticipants(allParticipants);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  }, [groupId]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchExpenses(), fetchMembers()]);
      setIsLoading(false);
    };
    fetchData();
  }, [fetchExpenses, fetchMembers]);

  const handleExpenseAdded = () => {
    fetchExpenses();
  };

  const handleExpenseUpdated = () => {
    fetchExpenses();
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditDialogOpen(true);
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }

      toast.success("Expense deleted");
      fetchExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
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
                  <div className="rounded-full bg-muted h-10 w-10"></div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Expenses
          </h2>
          <p className="text-muted-foreground">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'full' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('full')}
              className="rounded-none border-r"
            >
              <List className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Full</span>
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('compact')}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Compact</span>
            </Button>
          </div>
          <AddExpenseDialog groupId={groupId} currency={currency} onExpenseAdded={handleExpenseAdded} />
        </div>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No expenses yet</h3>
            <p className="text-muted-foreground mb-6">
              Start tracking shared expenses by adding the first one
            </p>
            <AddExpenseDialog groupId={groupId} currency={currency} onExpenseAdded={handleExpenseAdded}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add First Expense
              </Button>
            </AddExpenseDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => {
            const userBalance = getCurrentUserBalance(expense);
            
            return viewMode === 'compact' ? (
              // Compact View
              <Card key={expense.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {expense.paidBy.image && (
                        <AvatarImage src={expense.paidBy.image} />
                      )}
                      <AvatarFallback className="text-sm">
                        {expense.paidBy.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between w-full">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight mb-1">
                            {expense.description}
                          </h3>
                          {expense.category && (
                            <Badge variant="secondary" className="text-xs mb-2">
                              {expense.category}
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Paid by {formatNameCompact(expense.paidBy.name)}
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="font-semibold text-base mb-1">
                            {formatAmount(expense.amount, currency)}
                          </div>
                          {userBalance && (
                            <div className={`text-xs font-medium ${
                              userBalance.type === 'owed' ? 'text-green-600 dark:text-green-400' :
                              userBalance.type === 'owes' ? 'text-red-600 dark:text-red-400' :
                              userBalance.type === 'not_involved' ? 'text-muted-foreground' :
                              'text-muted-foreground' // settled
                            }`}>
                              {userBalance.type === 'owed' && `You are owed ${formatAmount(userBalance.amount.toString(), currency)}`}
                              {userBalance.type === 'owes' && `You owe ${formatAmount(userBalance.amount.toString(), currency)}`}
                              {userBalance.type === 'not_involved' && 'Not involved'}
                              {userBalance.type === 'settled' && 'You are even'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Compact actions - hidden by default, show on group hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditExpense(expense)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExpense(expense.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Full View (existing design)
              <Card key={expense.id}>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Main expense info */}
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {expense.paidBy.image && (
                          <AvatarImage src={expense.paidBy.image} />
                        )}
                        <AvatarFallback>
                          {expense.paidBy.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold truncate">
                                {expense.description}
                              </h3>
                              {expense.category && (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  {expense.category}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{expense.paidBy.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                <span>{new Date(expense.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-semibold mb-1">
                              {formatAmount(expense.amount, currency)}
                            </div>
                            {userBalance && (
                              <div className={`text-sm font-medium ${
                                userBalance.type === 'owed' ? 'text-green-600 dark:text-green-400' :
                                userBalance.type === 'owes' ? 'text-red-600 dark:text-red-400' :
                                userBalance.type === 'not_involved' ? 'text-muted-foreground' :
                                'text-muted-foreground' // settled
                              }`}>
                                {userBalance.type === 'owed' && `You are owed ${formatAmount(userBalance.amount.toString(), currency)}`}
                                {userBalance.type === 'owes' && `You owe ${formatAmount(userBalance.amount.toString(), currency)}`}
                                {userBalance.type === 'not_involved' && 'Not involved'}
                                {userBalance.type === 'settled' && 'You are even'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Participants */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Split between {expense.participants.length} member{expense.participants.length !== 1 ? 's' : ''}:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {expense.participants.map((participant) => (
                          <div
                            key={participant.userId}
                            className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded flex-shrink-0"
                          >
                            <Avatar className="h-4 w-4">
                              {participant.user.image && (
                                <AvatarImage src={participant.user.image} />
                              )}
                              <AvatarFallback className="text-xs">
                                {participant.user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="max-w-[100px] truncate">{participant.user.name}</span>
                            <span className="text-muted-foreground">
                              {formatAmount(participant.shareAmount, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer with timestamp and actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true })}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditExpense(expense)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteExpense(expense.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editingExpense && (
        <EditExpenseDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          expense={{
            id: editingExpense.id,
            description: editingExpense.description,
            amount: editingExpense.amount,
            date: editingExpense.date,
            paidBy: editingExpense.paidBy.id,
            paidByType: editingExpense.paidBy.isPlaceholder ? "placeholder" : "user",
            participants: editingExpense.participants.map(p => ({
              userId: p.userId,
              userType: p.userType,
              shareAmount: p.shareAmount,
            })),
          }}
          participants={participants}
          groupId={groupId}
          currency={currency}
          onExpenseUpdated={handleExpenseUpdated}
        />
      )}
    </div>
  );
}