"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Receipt, ArrowLeft, Check, Wand2 } from "lucide-react";
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

type ViewMode = "main" | "paidBy" | "split";

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
  const [paidBy, setPaidBy] = useState("");
  const [paidByName, setPaidByName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState(new Set<string>());
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("main");

  // Get current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userResponse = await fetch("/api/user");
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUserId(userData.id);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  // Initialize form with expense data
  useEffect(() => {
    if (expense && participants.length > 0) {
      setDescription(expense.description);
      setAmount(expense.amount);
      setPaidBy(expense.paidBy);
      
      // Set paid by name
      const paidByParticipant = participants.find(p => p.id === expense.paidBy);
      setPaidByName(paidByParticipant?.name || "");
      
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
  }, [expense, currentUserId, participants]);

  // Reset view mode when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setViewMode("main");
    }
  }, [open]);

  const handlePaidByChange = (value: string) => {
    setPaidBy(value);
    const participant = participants.find(p => p.id === value);
    setPaidByName(participant?.name || "");
    setViewMode("main");
  };

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

  const payTheRest = (participantId: string) => {
    const expenseAmount = parseFloat(amount || "0");
    const currentTotal = Array.from(selectedMembers).reduce((sum, memberId) => {
      if (memberId === participantId) return sum; // Skip this participant
      return sum + (parseFloat(customAmounts[memberId]) || 0);
    }, 0);
    
    const remainder = expenseAmount - currentTotal;
    
    setCustomAmounts(prev => ({
      ...prev,
      [participantId]: Math.max(0, remainder).toFixed(2)
    }));
    
    toast.success(`Updated to pay the remaining ${getCurrencySymbol(currency)}${Math.max(0, remainder).toFixed(2)}`);
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
        date: new Date().toISOString(), // Always use current date for consistency
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

  const getSplitTypeLabel = () => {
    if (splitType === "equal") {
      if (selectedMembers.size === participants.length) {
        return "equally";
      } else {
        return `${selectedMembers.size} people`;
      }
    } else {
      return "custom";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 sm:max-w-md w-full sm:w-auto h-full sm:h-auto max-h-full sm:max-h-[calc(100vh-2rem)] flex flex-col sm:block">
        {viewMode === "main" && (
          <form onSubmit={handleSubmit} className="flex flex-col h-full sm:h-auto">
            <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
              <DialogTitle>Edit expense</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4 flex-grow sm:flex-grow-0 overflow-y-auto">
              {/* Description Field */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  placeholder="Enter a description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex-1 border-0 shadow-none px-0 text-base focus-visible:ring-0"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Amount Field */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <span className="text-xl font-medium text-muted-foreground">
                    {getCurrencySymbol(currency)}
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 border-0 shadow-none px-0 text-2xl font-semibold focus-visible:ring-0"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Paid By and Split */}
              <div className="flex items-center justify-center gap-2 py-2">
                <span className="text-sm text-muted-foreground">Paid by</span>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("paidBy")}
                  disabled={isLoading}
                >
                  {paidByName}
                </Button>

                <span className="text-sm text-muted-foreground">and split</span>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("split")}
                  disabled={isLoading}
                >
                  {getSplitTypeLabel()}
                </Button>
              </div>
            </div>

            <DialogFooter className="px-6 pb-6 flex-shrink-0 border-t sm:border-t-0 bg-background">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !description || !amount}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Expense"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {viewMode === "paidBy" && (
          <div className="flex flex-col h-full sm:h-auto">
            <DialogHeader className="px-6 pt-6 pb-4 flex flex-row items-center gap-3 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("main")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle>Who paid?</DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6 flex-grow overflow-y-auto">
              <RadioGroup value={paidBy} onValueChange={handlePaidByChange}>
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center space-x-3 py-3 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-md"
                    onClick={() => handlePaidByChange(participant.id)}
                  >
                    <RadioGroupItem value={participant.id} id={`paid-${participant.id}`} />
                    <Label 
                      htmlFor={`paid-${participant.id}`} 
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <Avatar className="h-8 w-8">
                        {participant.type === "user" && participant.image && (
                          <AvatarImage src={participant.image} />
                        )}
                        <AvatarFallback className="text-xs">
                          {participant.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {participant.name}
                        </div>
                        {participant.type === "placeholder" && (
                          <div className="text-xs text-muted-foreground">Pending</div>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        )}

        {viewMode === "split" && (
          <div className="flex flex-col h-full sm:h-auto">
            <DialogHeader className="px-6 pt-6 pb-4 flex flex-row items-center gap-3 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("main")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle>Split options</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4 flex-grow overflow-y-auto">
              {/* Split Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Split type</Label>
                <RadioGroup value={splitType} onValueChange={(value) => setSplitType(value as "equal" | "custom")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="equal" id="equal-split" />
                    <Label htmlFor="equal-split">Split equally</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom-split" />
                    <Label htmlFor="custom-split">Custom amounts</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Participants */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {splitType === "equal" ? "Split equally between:" : "Custom split:"}
                </Label>
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center space-x-3 py-2"
                  >
                    <Checkbox
                      id={`split-${participant.id}`}
                      checked={selectedMembers.has(participant.id)}
                      onCheckedChange={(checked) => 
                        handleMemberToggle(participant.id, checked as boolean)
                      }
                    />
                    <Avatar className="h-8 w-8">
                      {participant.type === "user" && participant.image && (
                        <AvatarImage src={participant.image} />
                      )}
                      <AvatarFallback className="text-xs">
                        {participant.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">
                        {participant.name}
                      </div>
                      {participant.type === "placeholder" && (
                        <div className="text-xs text-muted-foreground">Pending</div>
                      )}
                    </div>
                    {selectedMembers.has(participant.id) && (
                      <div className="flex items-center gap-1">
                        {splitType === "custom" ? (
                          <>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={customAmounts[participant.id] || "0.00"}
                              onChange={(e) => setCustomAmounts(prev => ({
                                ...prev,
                                [participant.id]: e.target.value
                              }))}
                              className="w-20 h-8 text-sm"
                              placeholder="0.00"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-primary/10"
                              onClick={() => payTheRest(participant.id)}
                              title="Pay the rest"
                            >
                              <Wand2 className="h-3 w-3 text-primary" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground w-20 text-right">
                            {getCurrencySymbol(currency)}{calculateSplitAmounts()[participant.id] || "0.00"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Total validation for custom split */}
              {splitType === "custom" && selectedMembers.size > 0 && (
                <div className="mt-4 p-3 bg-muted/50 rounded-md">
                  <div className="flex justify-between items-center text-sm">
                    <span>Total custom amounts:</span>
                    <span className={`font-medium ${validateCustomAmounts() ? 'text-green-600' : 'text-red-600'}`}>
                      {getCurrencySymbol(currency)}{Array.from(selectedMembers).reduce((sum, id) => 
                        sum + (parseFloat(customAmounts[id]) || 0), 0
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Expected total:</span>
                    <span className="font-medium">
                      {getCurrencySymbol(currency)}{parseFloat(amount || "0").toFixed(2)}
                    </span>
                  </div>
                  {!validateCustomAmounts() && (
                    <div className="text-xs text-red-600 mt-1">
                      Custom amounts must add up to the total expense amount.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex-shrink-0 border-t sm:border-t-0 bg-background">
              <Button
                className="w-full"
                onClick={() => setViewMode("main")}
              >
                <Check className="h-4 w-4 mr-2" />
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}