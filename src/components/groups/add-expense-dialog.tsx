"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Receipt, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/lib/currency";
import { useSession } from "@/lib/auth-client";

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

type ViewMode = "main" | "paidBy" | "split";

export function AddExpenseDialog({ groupId, currency = "GBP", onExpenseAdded, children }: AddExpenseDialogProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("main");

  // Form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paidByName, setPaidByName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Fetch group members and placeholder users
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
      
      // Default to current user if they are in the group, otherwise first participant
      if (!paidBy && allParticipants.length > 0) {
        const currentUser = session?.user;
        const currentUserParticipant = currentUser 
          ? allParticipants.find(p => p.id === currentUser.id)
          : null;
        
        if (currentUserParticipant) {
          setPaidBy(currentUserParticipant.id);
          setPaidByName(currentUserParticipant.name);
        } else {
          setPaidBy(allParticipants[0].id);
          setPaidByName(allParticipants[0].name);
        }
      }
      
      // Default to all members selected for split
      const allIds = allParticipants.map(p => p.id);
      setSelectedMembers(new Set(allIds));
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load group members");
    }
  }, [groupId, paidBy, session]);


  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, fetchMembers]);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    // Reset to current user if they are in the group, otherwise first participant
    if (participants.length > 0) {
      const currentUser = session?.user;
      const currentUserParticipant = currentUser 
        ? participants.find(p => p.id === currentUser.id)
        : null;
      
      if (currentUserParticipant) {
        setPaidBy(currentUserParticipant.id);
        setPaidByName(currentUserParticipant.name);
      } else {
        setPaidBy(participants[0].id);
        setPaidByName(participants[0].name);
      }
    } else {
      setPaidBy("");
      setPaidByName("");
    }
    const allIds = participants.map(p => p.id);
    setSelectedMembers(new Set(allIds));
    setSplitType("equal");
    setCustomAmounts({});
    setViewMode("main");
  };

  const handlePaidByChange = (value: string) => {
    setPaidBy(value);
    const participant = participants.find(p => p.id === value);
    setPaidByName(participant?.name || "");
    setViewMode("main");
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
        date: new Date().toISOString(), // Always use current date
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

  const getSplitTypeLabel = () => {
    if (selectedMembers.size === participants.length) {
      return "equally";
    } else if (splitType === "equal") {
      return `${selectedMembers.size} people`;
    } else {
      return "custom";
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 sm:max-w-md w-full sm:w-auto h-full sm:h-auto max-h-full sm:max-h-[calc(100vh-2rem)] flex flex-col sm:block">
        {viewMode === "main" && (
          <form onSubmit={handleSubmit} className="flex flex-col h-full sm:h-auto">
            <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
              <DialogTitle>Add expense</DialogTitle>
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
                >
                  {getSplitTypeLabel()}
                </Button>
              </div>
            </div>

            <DialogFooter className="px-6 pb-6 flex-shrink-0 border-t sm:border-t-0 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !description || !amount}>
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
              <div className="space-y-2">
                <Label className="text-sm font-medium">Split equally between:</Label>
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center space-x-3 py-2 hover:bg-muted/50 -mx-2 px-2 rounded-md cursor-pointer"
                    onClick={() => handleMemberToggle(participant.id, !selectedMembers.has(participant.id))}
                  >
                    <Checkbox
                      id={`split-${participant.id}`}
                      checked={selectedMembers.has(participant.id)}
                      onCheckedChange={(checked) => 
                        handleMemberToggle(participant.id, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={`split-${participant.id}`}
                      className="flex items-center gap-2 cursor-pointer flex-1 font-normal"
                    >
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
                      {selectedMembers.has(participant.id) && amount && (
                        <span className="text-sm text-muted-foreground">
                          {getCurrencySymbol(currency)}{(parseFloat(amount) / selectedMembers.size).toFixed(2)}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
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