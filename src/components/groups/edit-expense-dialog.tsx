"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Calculator } from "lucide-react";
import { toast } from "sonner";

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transportation", 
  "Accommodation",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Healthcare",
  "Other"
];

interface Member {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface ExpenseData {
  id: string;
  description: string;
  amount: string;
  category?: string;
  date: string;
  paidBy: string;
  participants: Array<{
    userId: string;
    shareAmount: string;
  }>;
}

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseData;
  members: Member[];
  groupId: string;
  onExpenseUpdated: () => void;
}

export function EditExpenseDialog({
  open,
  onOpenChange,
  expense,
  members,
  groupId,
  onExpenseUpdated,
}: EditExpenseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [selectedMembers, setSelectedMembers] = useState(new Set<string>());
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Initialize form with expense data
  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmount(expense.amount);
      setCategory(expense.category || "");
      setDate(new Date(expense.date).toISOString().split('T')[0]);
      setPaidBy(expense.paidBy);
      
      const participantIds = new Set(expense.participants.map(p => p.userId));
      setSelectedMembers(participantIds);
      
      // Set custom amounts
      const amounts: Record<string, string> = {};
      expense.participants.forEach(p => {
        amounts[p.userId] = p.shareAmount;
      });
      setCustomAmounts(amounts);
      
      // Determine if it's equal split
      const expenseAmount = parseFloat(expense.amount);
      const participantCount = expense.participants.length;
      const equalAmount = expenseAmount / participantCount;
      const isEqualSplit = expense.participants.every(p => 
        Math.abs(parseFloat(p.shareAmount) - equalAmount) < 0.01
      );
      
      setSplitType(isEqualSplit ? "equal" : "custom");
    }
  }, [expense]);

  const calculateSplitAmounts = (): Record<string, string> => {
    if (splitType === "equal") {
      const amountPerPerson = parseFloat(amount) / selectedMembers.size;
      const amounts: Record<string, string> = {};
      selectedMembers.forEach(memberId => {
        amounts[memberId] = amountPerPerson.toFixed(2);
      });
      return amounts;
    }
    return customAmounts;
  };

  const validateCustomAmounts = (): boolean => {
    // For equal split, we don't need to validate since it's calculated automatically
    if (splitType === "equal") {
      return true;
    }
    
    // For custom split, validate that amounts add up to total
    const totalCustom = Array.from(selectedMembers).reduce((sum, memberId) => {
      return sum + (parseFloat(customAmounts[memberId]) || 0);
    }, 0);
    
    return Math.abs(totalCustom - parseFloat(amount)) < 0.01;
  };

  const handleMemberToggle = (memberId: string, checked: boolean) => {
    const newSelected = new Set(selectedMembers);
    if (checked) {
      newSelected.add(memberId);
      if (splitType === "equal") {
        const newAmount = parseFloat(amount) / newSelected.size;
        setCustomAmounts(prev => ({
          ...prev,
          [memberId]: newAmount.toFixed(2)
        }));
      } else {
        setCustomAmounts(prev => ({
          ...prev,
          [memberId]: "0.00"
        }));
      }
    } else {
      newSelected.delete(memberId);
      setCustomAmounts(prev => {
        const newAmounts = { ...prev };
        delete newAmounts[memberId];
        return newAmounts;
      });
    }
    setSelectedMembers(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() || !amount || !paidBy || selectedMembers.size === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validateCustomAmounts()) {
      toast.error("Split amounts must equal the total expense amount");
      return;
    }

    setIsLoading(true);
    try {
      const splitAmounts = calculateSplitAmounts();
      
      const expenseData = {
        description: description.trim(),
        amount: parseFloat(amount),
        category: category || null,
        date: new Date(date).toISOString(),
        paidBy,
        participants: Array.from(selectedMembers).map(memberId => ({
          userId: memberId,
          shareAmount: parseFloat(splitAmounts[memberId])
        }))
      };

      const response = await fetch(`/api/groups/${groupId}/expenses/${expense.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update expense");
      }

      toast.success("Expense updated successfully!");
      onOpenChange(false);
      onExpenseUpdated();
    } catch (error) {
      console.error("Error updating expense:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update expense");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update the expense details and participant information.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Dinner at restaurant"
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy} required disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Who paid for this?" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={member.image} />
                          <AvatarFallback className="text-xs">
                            {member.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {member.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label>Participants</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="equal-split"
                      checked={splitType === "equal"}
                      onCheckedChange={(checked) => 
                        setSplitType(checked ? "equal" : "custom")
                      }
                      disabled={isLoading}
                    />
                    <Label htmlFor="equal-split" className="text-sm">Equal split</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="custom-split"
                      checked={splitType === "custom"}
                      onCheckedChange={(checked) => 
                        setSplitType(checked ? "custom" : "equal")
                      }
                      disabled={isLoading}
                    />
                    <Label htmlFor="custom-split" className="text-sm">Custom amounts</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-40 overflow-y-auto">
                {members.map((member) => {
                  const isSelected = selectedMembers.has(member.id);
                  const splitAmounts = calculateSplitAmounts();
                  
                  return (
                    <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`member-${member.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handleMemberToggle(member.id, !!checked)
                          }
                          disabled={isLoading}
                        />
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.image} />
                          <AvatarFallback>
                            {member.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          {splitType === "equal" ? (
                            <div className="text-sm font-medium">
                              ${splitAmounts[member.id] || "0.00"}
                            </div>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={customAmounts[member.id] || ""}
                              onChange={(e) => setCustomAmounts(prev => ({
                                ...prev,
                                [member.id]: e.target.value
                              }))}
                              className="w-20"
                              placeholder="0.00"
                              disabled={isLoading}
                            />
                          )}
                          <Calculator className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Updating..." : "Update Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}