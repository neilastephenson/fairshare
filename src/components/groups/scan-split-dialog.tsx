"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, Scan, Receipt, Loader2, X, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ScanSplitDialogProps {
  groupId: string;
  currency?: string;
  onReceiptProcessed?: () => void;
  children?: React.ReactNode;
}

type ViewMode = "upload" | "participants" | "processing" | "claiming";

interface GroupMember {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  joinedAt: string;
}

interface PlaceholderUser {
  id: string;
  name: string;
  groupId: string;
  createdAt: string;
}

interface Participant {
  id: string;
  name: string;
  image: string | null;
  type: "user" | "placeholder";
}

export function ScanSplitDialog({ 
  groupId, 
  currency = "GBP", 
  onReceiptProcessed, 
  children 
}: ScanSplitDialogProps) {
  // TODO: Use currency in API calls
  console.log("Group ID:", groupId, "Currency:", currency);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setViewMode("upload");
    setIsProcessing(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setParticipants([]);
    setSelectedParticipants(new Set());
    setLoadingParticipants(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  const fetchParticipants = useCallback(async () => {
    setLoadingParticipants(true);
    try {
      // Fetch both members and placeholder users
      const [membersResponse, placeholdersResponse] = await Promise.all([
        fetch(`/api/groups/${groupId}/members`),
        fetch(`/api/groups/${groupId}/placeholder-users`)
      ]);

      if (!membersResponse.ok || !placeholdersResponse.ok) {
        throw new Error('Failed to fetch participants');
      }

      const { members }: { members: GroupMember[] } = await membersResponse.json();
      const { placeholderUsers: placeholders }: { placeholderUsers: PlaceholderUser[] } = await placeholdersResponse.json();

      // Combine members and placeholders
      const allParticipants: Participant[] = [
        ...members.map(member => ({
          id: member.id,
          name: member.name,
          image: member.image,
          type: "user" as const,
        })),
        ...placeholders.map(placeholder => ({
          id: placeholder.id,
          name: placeholder.name,
          image: null,
          type: "placeholder" as const,
        }))
      ];

      setParticipants(allParticipants);
      // Select all participants by default
      setSelectedParticipants(new Set(allParticipants.map(p => p.id)));
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast.error('Failed to load group members');
    } finally {
      setLoadingParticipants(false);
    }
  }, [groupId]);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Move to participant selection
    setViewMode("participants");
    fetchParticipants();
  }, [fetchParticipants]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(participantId)) {
        newSelected.delete(participantId);
      } else {
        newSelected.add(participantId);
      }
      return newSelected;
    });
  };

  const handleProceedToProcessing = () => {
    if (selectedParticipants.size === 0) {
      toast.error("Please select at least one participant");
      return;
    }
    setViewMode("processing");
    handleUpload();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a receipt image");
      return;
    }

    setIsProcessing(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('receipt', selectedFile);
      
      // Add selected participants
      const selectedParticipantList = participants.filter(p => selectedParticipants.has(p.id));
      formData.append('participants', JSON.stringify(selectedParticipantList));

      // Upload and process receipt
      const response = await fetch(`/api/groups/${groupId}/receipts/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process receipt');
      }

      const data = await response.json();
      
      toast.success("Receipt processed successfully!");
      
      // Close dialog and navigate to claiming interface
      setOpen(false);
      onReceiptProcessed?.();
      
      // Navigate to claiming interface with session ID
      router.push(`/groups/${groupId}/receipts/${data.sessionId}`);
      
    } catch (error) {
      console.error("Error processing receipt:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process receipt. Please try again.");
      setViewMode("participants");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Scan className="h-4 w-4 mr-2" />
            Scan & Split
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-md p-0 sm:max-w-md w-full sm:w-auto h-full sm:h-auto max-h-full sm:max-h-[calc(100vh-2rem)] flex flex-col sm:block">
        {viewMode === "upload" && (
          <div className="flex flex-col h-full sm:h-auto">
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Scan & Split
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Upload a receipt to start splitting items with your group
              </p>
            </DialogHeader>

            <div className="px-6 py-4 flex-grow overflow-y-auto">
              {!selectedFile ? (
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="space-y-4">
                    <div className="flex justify-center space-x-4">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Camera className="h-6 w-6 text-primary" />
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Upload Receipt</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Drag and drop your receipt here, or click to select
                      </p>
                      <div className="text-xs text-muted-foreground">
                        <p>Supported: JPG, PNG, HEIC</p>
                        <p>Max size: 10MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {previewUrl && (
                          <div className="flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Receipt preview"
                              className="w-16 h-16 object-cover rounded border"
                            />
                          </div>
                        )}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm truncate">
                                {selectedFile.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={handleRemoveFile}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Button 
                    onClick={() => {
                      setViewMode("participants");
                      fetchParticipants();
                    }}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Choose Participants
                  </Button>
                </div>
              )}
            </div>

            {!selectedFile && (
              <div className="px-6 pb-6 flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </div>
            )}
          </div>
        )}

        {viewMode === "participants" && (
          <div className="flex flex-col h-full sm:h-auto">
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Participants
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Choose who&apos;s involved in this bill (all selected by default)
              </p>
            </DialogHeader>

            <div className="px-6 py-4 flex-grow overflow-y-auto">
              {loadingParticipants ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading participants...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleParticipant(participant.id)}
                    >
                      <Checkbox
                        checked={selectedParticipants.has(participant.id)}
                        onCheckedChange={() => toggleParticipant(participant.id)}
                      />
                      <Avatar className="h-8 w-8">
                        {participant.image && participant.type === "user" && (
                          <AvatarImage src={participant.image} alt={participant.name} />
                        )}
                        <AvatarFallback>
                          {participant.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{participant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {participant.type === "placeholder" ? "Guest" : "Member"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex-shrink-0 space-y-3">
              <div className="text-sm text-muted-foreground text-center">
                {selectedParticipants.size} of {participants.length} participants selected
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setViewMode("upload")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleProceedToProcessing}
                  disabled={selectedParticipants.size === 0 || isProcessing}
                  className="flex-1"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Process Receipt
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {viewMode === "processing" && (
          <div className="flex flex-col h-full sm:h-auto">
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <DialogTitle>Processing Receipt</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-8 flex-grow flex flex-col items-center justify-center text-center">
              <div className="space-y-6">
                <div className="relative">
                  <div className="p-6 bg-primary/10 rounded-full">
                    <Receipt className="h-12 w-12 text-primary" />
                  </div>
                  <Loader2 className="h-6 w-6 absolute -top-1 -right-1 animate-spin text-primary" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-medium">Reading your receipt...</h3>
                  <p className="text-sm text-muted-foreground">
                    We&apos;re extracting items and prices using AI
                  </p>
                </div>
                
                <div className="w-full max-w-xs mx-auto">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}