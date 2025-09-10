// Global connection manager for SSE streams
interface BroadcastData {
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
    claimedAt: Date;
  }>;
  timestamp?: string;
  message?: string;
}

// Store active connections per session
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export function addConnection(sessionId: string, controller: ReadableStreamDefaultController) {
  console.log(`[CONNECTION] Adding connection to session ${sessionId}`);
  if (!connections.has(sessionId)) {
    console.log(`[CONNECTION] Creating new connection set for session ${sessionId}`);
    connections.set(sessionId, new Set());
  }
  connections.get(sessionId)!.add(controller);
  console.log(`[CONNECTION] Added connection to session ${sessionId}, total: ${connections.get(sessionId)?.size}`);
}

export function removeConnection(sessionId: string, controller: ReadableStreamDefaultController) {
  console.log(`[CONNECTION] Removing connection from session ${sessionId}`);
  const sessionConnections = connections.get(sessionId);
  if (sessionConnections) {
    sessionConnections.delete(controller);
    console.log(`[CONNECTION] Connection deleted, remaining: ${sessionConnections.size}`);
    if (sessionConnections.size === 0) {
      console.log(`[CONNECTION] No connections left, removing session ${sessionId} from map`);
      connections.delete(sessionId);
    }
  } else {
    console.log(`[CONNECTION] No session found for ${sessionId} when trying to remove connection`);
  }
  console.log(`[CONNECTION] Final count for session ${sessionId}: ${connections.get(sessionId)?.size || 0}`);
}

export function broadcastToSession(sessionId: string, data: BroadcastData) {
  const sessionConnections = connections.get(sessionId);
  console.log(`[BROADCAST] Broadcasting to session ${sessionId}, connections: ${sessionConnections?.size || 0}`);
  console.log(`[BROADCAST] Available sessions in map: ${Array.from(connections.keys()).join(', ')}`);
  
  if (sessionConnections && sessionConnections.size > 0) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    // Send to all connections, removing failed ones
    const failedConnections = new Set<ReadableStreamDefaultController>();
    let connectionIndex = 0;
    sessionConnections.forEach((controller) => {
      try {
        console.log(`[BROADCAST] Sending message to connection ${connectionIndex}: ${message.trim()}`);
        controller.enqueue(new TextEncoder().encode(message));
        console.log(`[BROADCAST] Successfully sent to connection ${connectionIndex}`);
        connectionIndex++;
      } catch (error) {
        console.error(`Failed to send to connection ${connectionIndex}, marking for removal:`, error);
        failedConnections.add(controller);
        connectionIndex++;
      }
    });
    
    // Remove failed connections
    failedConnections.forEach((controller) => {
      sessionConnections.delete(controller);
    });
    
    console.log(`Broadcast sent to session ${sessionId}: ${sessionConnections.size} connections`);
  } else {
    console.log(`No connections found for session ${sessionId}`);
  }
}

export function getConnectionCount(sessionId: string): number {
  return connections.get(sessionId)?.size || 0;
}