"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// Removed unused Separator import
import { AddExpenseDialog } from "./add-expense-dialog";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { Receipt, Plus, Trash2, Calendar, User, Edit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { formatAmount } from "@/lib/currency";

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
    email: string;
    image?: string;
  };
  participants: Array<{
    userId: string;
    shareAmount: string;
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
    };
  }>;
}

interface Member {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface ExpenseListProps {
  groupId: string;
  currency?: string;
}

export function ExpenseList({ groupId, currency = "GBP" }: ExpenseListProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
      const response = await fetch(`/api/groups/${groupId}/members`);
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      const data = await response.json();
      setMembers(data.members);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Expenses
          </h2>
          <p className="text-muted-foreground">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <AddExpenseDialog groupId={groupId} currency={currency} onExpenseAdded={handleExpenseAdded} />
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
          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <Avatar className="h-10 w-10 mt-1">
                      <AvatarImage src={expense.paidBy.image} />
                      <AvatarFallback>
                        {expense.paidBy.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {expense.description}
                        </h3>
                        {expense.category && (
                          <Badge variant="secondary" className="text-xs">
                            {expense.category}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{expense.paidBy.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(expense.date).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="text-lg font-semibold">
                        {formatAmount(expense.amount, currency)}
                      </div>

                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          Split between {expense.participants.length} member{expense.participants.length !== 1 ? 's' : ''}:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {expense.participants.map((participant) => (
                            <div
                              key={participant.userId}
                              className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
                            >
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={participant.user.image} />
                                <AvatarFallback className="text-xs">
                                  {participant.user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{participant.user.name}</span>
                              <span className="text-muted-foreground">
                                {formatAmount(participant.shareAmount, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true })}
                    </span>
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
              </CardContent>
            </Card>
          ))}
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
            category: editingExpense.category,
            date: editingExpense.date,
            paidBy: editingExpense.paidBy.id,
            participants: editingExpense.participants.map(p => ({
              userId: p.userId,
              shareAmount: p.shareAmount,
            })),
          }}
          members={members}
          groupId={groupId}
          currency={currency}
          onExpenseUpdated={handleExpenseUpdated}
        />
      )}
    </div>
  );
}