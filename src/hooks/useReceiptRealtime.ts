import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

interface RealtimeEvent {
  type: string;
  itemId?: string;
  itemName?: string;
  itemPrice?: number;
  userId?: string;
  userName?: string;
  userImage?: string;
  totalClaims?: number;
  sharePerPerson?: number;
  claimersInfo?: Array<{
    userId: string;
    userName: string;
    userImage?: string;
    userType: string;
    claimedAt: string;
  }>;
  timestamp?: string;
  message?: string;
}

interface UseReceiptRealtimeProps {
  groupId: string;
  sessionId: string;
  currentUserId: string;
  onUpdate: () => void;
  onUserJoined?: (userId: string, userName: string) => void;
}

export function useReceiptRealtime({
  groupId,
  sessionId,
  currentUserId,
  onUpdate,
  onUserJoined,
}: UseReceiptRealtimeProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const connectedRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  const onUserJoinedRef = useRef(onUserJoined);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onUserJoinedRef.current = onUserJoined;
  }, [onUpdate, onUserJoined]);

  const connect = useCallback(() => {
    if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
      return; // Already connected and open
    }

    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    console.log("Connecting to SSE stream...");
    connectedRef.current = true;

    const eventSource = new EventSource(
      `/api/groups/${groupId}/receipts/${sessionId}/stream`
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("SSE connection opened");
    };

    eventSource.onmessage = (event) => {
      try {
        console.log("Raw SSE message received:", event.data);
        const data: RealtimeEvent = JSON.parse(event.data);
        console.log("Parsed SSE event:", data);

        switch (data.type) {
          case "connected":
            toast.success("Real-time updates enabled ⚡", { duration: 2000 });
            break;

          case "item_claimed":
            if (data.userId && data.userId !== currentUserId) {
              toast.success(
                `${data.userName} claimed "${data.itemName}" 🎉`,
                { duration: 3000 }
              );
            }
            // Always update the UI, even for own actions
            console.log("Triggering UI update for item_claimed");
            onUpdateRef.current();
            break;

          case "item_unclaimed":
            if (data.userId && data.userId !== currentUserId) {
              toast.info(
                `${data.userName} removed themselves from "${data.itemName}"`,
                { duration: 3000 }
              );
            }
            // Always update the UI, even for own actions
            console.log("Triggering UI update for item_unclaimed");
            onUpdateRef.current();
            break;

          case "user_joined":
            if (data.userId && data.userId !== currentUserId && onUserJoinedRef.current) {
              onUserJoinedRef.current(data.userId, data.userName || "Someone");
              toast.info(
                `${data.userName} joined the receipt`,
                { duration: 2000 }
              );
            }
            break;

          default:
            console.log("Unknown SSE event type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error occurred:", error);
      console.log("EventSource readyState:", eventSource.readyState);
      console.log("EventSource state meanings: 0=CONNECTING, 1=OPEN, 2=CLOSED");
      connectedRef.current = false;
      
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Automatically reconnect after a delay
      reconnectTimeoutRef.current = setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          console.log("Attempting to reconnect SSE after error...");
          eventSourceRef.current = null;
          connectedRef.current = false;
          connect();
        }
      }, 2000); // Reduced delay for faster reconnection
    };

    return eventSource;
  }, [groupId, sessionId, currentUserId]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log("Closing SSE connection");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    connectedRef.current = false;
  }, []);

  useEffect(() => {
    // Only connect once when the hook is first used
    if (!eventSourceRef.current && !connectedRef.current) {
      connect();
    }

    // Cleanup on unmount or sessionId change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      connectedRef.current = false;
    };
  }, [connect]); // Include connect in dependencies

  return {
    isConnected: connectedRef.current,
    disconnect,
    reconnect: () => {
      disconnect();
      setTimeout(connect, 100);
    },
  };
}