"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface JoinGroupFormProps {
  groupId: string;
  groupName: string;
  inviteCode: string;
}

export function JoinGroupForm({ groupId, groupName, inviteCode }: JoinGroupFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleJoinGroup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/invite/${inviteCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join group");
      }

      toast.success(`Successfully joined ${groupName}!`);
      router.push(`/groups/${groupId}`);
    } catch (error) {
      console.error("Error joining group:", error);
      toast.error(error instanceof Error ? error.message : "Failed to join group");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleJoinGroup}
        disabled={isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Joining...
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Join {groupName}
          </>
        )}
      </Button>
      
      <p className="text-xs text-center text-muted-foreground">
        By joining, you agree to share expenses and settle debts with other group members
      </p>
    </div>
  );
}