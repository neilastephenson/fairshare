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
import { getCurrencySymbol } from "@/lib/currency";

interface Participant {
  id: string;
  name: string;
  email?: string;
  image?: string;
  type: "user" | "placeholder";
}

interface ExpenseData {
  id: string;
  description: string;
  amount: string;
  date: string;
  paidBy: string;
  paidByType: string;
  participants: Array<{
    userId: string;
    userType: string;
    shareAmount: string;
  }>;
}

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseData;
  participants: Participant[];
  groupId: string;
  currency?: string;
  onExpenseUpdated: () => void;
}

export function EditExpenseDialog({
  open,
  onOpenChange,
  expense,
  participants,
  groupId,
  currency = "GBP",
  onExpenseUpdated,
}: EditExpenseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
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
      const totalAmount = parseFloat(amount);
      const memberIds = Array.from(selectedMembers);
      
      // Calculate base amount per person
      const baseAmount = Math.floor((totalAmount * 100) / memberIds.length) / 100;
      const remainder = totalAmount - (baseAmount * memberIds.length);
      
      const amounts: Record<string, string> = {};
      // Distribute the remainder across the first few members to ensure exact total
      memberIds.forEach((memberId, index) => {
        // Add 0.01 to the first members to distribute the remainder
        const extraPenny = index < Math.round(remainder * 100) ? 0.01 : 0;
        amounts[memberId] = (baseAmount + extraPenny).toFixed(2);
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
      
      // Find if paidBy is a user or placeholder
      const paidByParticipant = participants.find(p => p.id === paidBy);
      const paidByType = paidByParticipant?.type || "user";
      
      const expenseData = {
        description: description.trim(),
        amount: parseFloat(amount),
        date: new Date(date).toISOString(),
        paidBy,
        paidByType,
        participants: Array.from(selectedMembers).map(memberId => {
          const participant = participants.find(p => p.id === memberId);
          return {
            userId: memberId,
            userType: participant?.type || "user",
            shareAmount: parseFloat(splitAmounts[memberId])
          };
        })
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
                <Label htmlFor="amount">Amount ({getCurrencySymbol(currency)})</Label>
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
              <Label>Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy} required disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Who paid for this?" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((participant) => (
                    <SelectItem key={participant.id} value={participant.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {participant.type === "user" && participant.image && (
                            <AvatarImage src={participant.image} />
                          )}
                          <AvatarFallback className="text-xs">
                            {participant.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{participant.name}</span>
                        {participant.type === "placeholder" && (
                          <span className="text-xs text-muted-foreground">(Placeholder)</span>
                        )}
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

              <div className="space-y-3">
                {participants.map((participant) => {
                  const isSelected = selectedMembers.has(participant.id);
                  const splitAmounts = calculateSplitAmounts();
                  
                  return (
                    <div key={participant.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`participant-${participant.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handleMemberToggle(participant.id, !!checked)
                          }
                          disabled={isLoading}
                        />
                        <Avatar className="w-8 h-8">
                          {participant.type === "user" && participant.image && (
                            <AvatarImage src={participant.image} />
                          )}
                          <AvatarFallback>
                            {participant.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{participant.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {participant.type === "user" ? participant.email : "(Placeholder)"}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          {splitType === "equal" ? (
                            <div className="text-sm font-medium">
                              ${splitAmounts[participant.id] || "0.00"}
                            </div>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={customAmounts[participant.id] || ""}
                              onChange={(e) => setCustomAmounts(prev => ({
                                ...prev,
                                [participant.id]: e.target.value
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