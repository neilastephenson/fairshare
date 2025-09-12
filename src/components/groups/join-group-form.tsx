"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, UserCheck } from "lucide-react";
// import { toast } from "sonner";

interface JoinGroupFormProps {
  groupId: string;
  groupName: string;
  inviteCode: string;
}

interface PlaceholderUser {
  id: string;
  name: string;
  createdAt: string;
}

export function JoinGroupForm({ groupId, groupName, inviteCode }: JoinGroupFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [placeholders, setPlaceholders] = useState<PlaceholderUser[]>([]);
  const [selectedOption, setSelectedOption] = useState<"new" | string>("new");
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchPlaceholders = async () => {
      try {
        const response = await fetch(`/api/invite/${inviteCode}`);
        if (response.ok) {
          const data = await response.json();
          setPlaceholders(data.unclaimedPlaceholders || []);
        }
      } catch (error) {
        console.error("Error fetching placeholders:", error);
      } finally {
        setLoadingPlaceholders(false);
      }
    };

    fetchPlaceholders();
  }, [inviteCode]);

  const handleJoinGroup = async () => {
    setIsLoading(true);
    try {
      const body: { placeholderUserId?: string } = {};
      if (selectedOption !== "new") {
        body.placeholderUserId = selectedOption;
      }

      const response = await fetch(`/api/invite/${inviteCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join group");
      }

      if (selectedOption !== "new") {
        const placeholder = placeholders.find(p => p.id === selectedOption);
        // toast.success(`Successfully joined ${groupName} as ${placeholder?.name}!`);
      } else {
        // toast.success(`Successfully joined ${groupName}!`);
      }
      router.push(`/groups/${groupId}`);
    } catch (error) {
      console.error("Error joining group:", error);
      // toast.error(error instanceof Error ? error.message : "Failed to join group");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Show placeholder options if available */}
      {!loadingPlaceholders && placeholders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-1">Are you one of these people?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              An admin has pre-added the following people to this group. If one of these is you, click on your name to automatically claim your space.
            </p>
            <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
              <div className="space-y-2">
                {placeholders.map((placeholder) => (
                  <div key={placeholder.id} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={placeholder.id} id={placeholder.id} />
                    <Label htmlFor={placeholder.id} className="flex-1 cursor-pointer flex items-center">
                      <UserCheck className="h-4 w-4 mr-2 text-primary" />
                      <span className="font-medium">{placeholder.name}</span>
                    </Label>
                  </div>
                ))}
                
                <div className="pt-2 border-t">
                  <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="new" id="new" />
                    <Label htmlFor="new" className="flex-1 cursor-pointer flex items-center">
                      <UserPlus className="h-4 w-4 mr-2" />
                      <span>None of these are me, continue</span>
                    </Label>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleJoinGroup}
        disabled={isLoading || loadingPlaceholders}
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
            {selectedOption !== "new" ? (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Continue as {placeholders.find(p => p.id === selectedOption)?.name}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Join {groupName}
              </>
            )}
          </>
        )}
      </Button>
      
      <p className="text-xs text-center text-muted-foreground">
        By joining, you agree to share expenses and settle debts with other group members
      </p>
    </div>
  );
}