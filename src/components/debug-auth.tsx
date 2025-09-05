"use client";

import { useSession } from "@/lib/auth-client";

export function DebugAuth() {
  const { data: session, isPending } = useSession();
  
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black text-white p-2 text-xs rounded z-50">
      <div>isPending: {isPending.toString()}</div>
      <div>session: {session ? "✅ Authenticated" : "❌ Not authenticated"}</div>
      {session && (
        <div>
          <div>User: {session.user?.name}</div>
          <div>Email: {session.user?.email}</div>
        </div>
      )}
    </div>
  );
}