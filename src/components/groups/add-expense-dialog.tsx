"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/lib/currency";

interface Member {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: string;
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

interface AddExpenseDialogProps {
  groupId: string;
  currency?: string;
  onExpenseAdded: () => void;
  children?: React.ReactNode;
}

export function AddExpenseDialog({ groupId, currency = "GBP", onExpenseAdded, children }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Fetch group members and placeholder users
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
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
      toast.error("Failed to load group members");
    } finally {
      setLoadingMembers(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, fetchMembers]);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split('T')[0]);
    setPaidBy("");
    setSelectedMembers(new Set());
    setSplitType("equal");
    setCustomAmounts({});
  };

  const handleMemberToggle = (memberId: string, checked: boolean) => {
    const newSelected = new Set(selectedMembers);
    if (checked) {
      newSelected.add(memberId);
    } else {
      newSelected.delete(memberId);
    }
    setSelectedMembers(newSelected);

    // Reset custom amounts when members change
    if (splitType === "custom") {
      setCustomAmounts({});
    }
  };

  const handleCustomAmountChange = (memberId: string, value: string) => {
    setCustomAmounts(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const calculateSplitAmounts = () => {
    const totalAmount = parseFloat(amount);
    const memberIds = Array.from(selectedMembers);
    
    if (splitType === "equal") {
      // Calculate base amount per person
      const baseAmount = Math.floor((totalAmount * 100) / memberIds.length) / 100;
      const remainder = totalAmount - (baseAmount * memberIds.length);
      
      // Distribute the remainder across the first few members to ensure exact total
      return memberIds.reduce((acc, id, index) => {
        // Add 0.01 to the first members to distribute the remainder
        const extraPenny = index < Math.round(remainder * 100) ? 0.01 : 0;
        acc[id] = (baseAmount + extraPenny).toFixed(2);
        return acc;
      }, {} as Record<string, string>);
    } else {
      return customAmounts;
    }
  };

  const validateCustomAmounts = () => {
    if (splitType === "custom") {
      const totalAmount = parseFloat(amount);
      const customTotal = Array.from(selectedMembers).reduce((sum, id) => {
        return sum + (parseFloat(customAmounts[id]) || 0);
      }, 0);
      
      return Math.abs(totalAmount - customTotal) < 0.01; // Allow for small floating point differences
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() || !amount || !paidBy || selectedMembers.size === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validateCustomAmounts()) {
      toast.error("Custom split amounts must equal the total expense amount");
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

      const response = await fetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add expense");
      }

      toast.success("Expense added successfully!");
      resetForm();
      setOpen(false);
      onExpenseAdded();
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add expense");
    } finally {
      setIsLoading(false);
    }
  };

  const getCustomTotal = () => {
    return Array.from(selectedMembers).reduce((sum, id) => {
      return sum + (parseFloat(customAmounts[id]) || 0);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogDescription>
            Record a shared expense and split it among group members
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="e.g., Dinner at restaurant"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({getCurrencySymbol(currency)}) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Paid By */}
          <div className="space-y-2">
            <Label>Paid By *</Label>
            {loadingMembers ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading members...</span>
              </div>
            ) : (
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select who paid" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((participant) => (
                    <SelectItem key={participant.id} value={participant.id}>
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-5 w-5">
                          {participant.type === "user" && participant.image && (
                            <AvatarImage src={participant.image} />
                          )}
                          <AvatarFallback className="text-xs">
                            {participant.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{participant.name}</span>
                        {participant.type === "placeholder" && (
                          <span className="text-xs text-muted-foreground">(Pending)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Split Among */}
          <div className="space-y-3">
            <Label>Split Among *</Label>
            {loadingMembers ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading members...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedMembers.has(participant.id)}
                        onCheckedChange={(checked) => 
                          handleMemberToggle(participant.id, checked as boolean)
                        }
                      />
                      <Avatar className="h-6 w-6">
                        {participant.type === "user" && participant.image && (
                          <AvatarImage src={participant.image} />
                        )}
                        <AvatarFallback className="text-xs">
                          {participant.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{participant.name}</span>
                      {participant.type === "placeholder" && (
                        <span className="text-xs text-muted-foreground ml-1">(Pending)</span>
                      )}
                    </div>
                    {selectedMembers.has(participant.id) && splitType === "custom" && (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={customAmounts[participant.id] || ""}
                        onChange={(e) => handleCustomAmountChange(participant.id, e.target.value)}
                        className="w-24"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Split Type */}
          {selectedMembers.size > 0 && (
            <div className="space-y-3">
              <Label>Split Type</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={splitType === "equal" ? "default" : "outline"}
                  onClick={() => setSplitType("equal")}
                  className="flex-1"
                >
                  Equal Split
                </Button>
                <Button
                  type="button"
                  variant={splitType === "custom" ? "default" : "outline"}
                  onClick={() => setSplitType("custom")}
                  className="flex-1"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Custom Split
                </Button>
              </div>

              {splitType === "equal" && amount && selectedMembers.size > 0 && (
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  Each person pays: {getCurrencySymbol(currency)}{(parseFloat(amount) / selectedMembers.size).toFixed(2)}
                </div>
              )}

              {splitType === "custom" && amount && (
                <div className="text-sm p-3 bg-muted rounded-lg">
                  <div className="flex justify-between">
                    <span>Total: {getCurrencySymbol(currency)}{parseFloat(amount).toFixed(2)}</span>
                    <span className={getCustomTotal() === parseFloat(amount) ? "text-green-600" : "text-red-600"}>
                      Custom Total: {getCurrencySymbol(currency)}{getCustomTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Expense"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}