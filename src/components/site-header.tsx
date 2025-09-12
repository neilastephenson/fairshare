"use client";

import Link from "next/link";
import { UserProfile } from "@/components/auth/user-profile";
import { Receipt, TestTube } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { data: session } = useSession();
  
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold min-w-0 flex-shrink-0">
          <Link
            href={session ? "/groups" : "/"}
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent truncate">
              FayrShare
            </span>
          </Link>
        </h1>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {/* Development test link */}
          {process.env.NODE_ENV === 'development' && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/test-receipt">
                <TestTube className="h-4 w-4 mr-2" />
                Test Receipt
              </Link>
            </Button>
          )}
          <UserProfile />
        </div>
      </div>
    </header>
  );
}
