"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calculator, 
  Receipt, 
  Clock,
  ArrowRight
} from "lucide-react";
import { useSession, signIn } from "@/lib/auth-client";

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Split Expenses,{" "}
            <span className="text-primary">Stay Friends</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Track group expenses, manage member balances, and settle up efficiently. 
            Simple expense sharing for trips, roommates, and group activities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {session ? (
              <Button size="lg" asChild>
                <Link href="/groups">
                  Go to Groups
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button 
                  size="lg"
                  onClick={() => {
                    signIn.social({
                      provider: "google",
                      callbackURL: "/groups",
                    });
                  }}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#how-it-works">Learn More</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Simple Expense Sharing</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to track and split group expenses
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Group Management</h3>
            <p className="text-sm text-muted-foreground">
              Create groups, invite members with a link, and manage admin roles easily.
            </p>
          </div>
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Expense Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Add expenses, choose who participated, and track balances automatically.
            </p>
          </div>
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Balance Overview</h3>
            <p className="text-sm text-muted-foreground">
              See who owes what at a glance with clear balance summaries for each member.
            </p>
          </div>
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Activity History</h3>
            <p className="text-sm text-muted-foreground">
              Complete log of all group expenses, edits, and member activity.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="container mx-auto px-4 py-16 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes and never worry about splitting bills again
          </p>
        </div>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              1
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Create a Group</h3>
              <p className="text-muted-foreground">
                Sign up with Google and create a group for your trip, household, or shared activity.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              2
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Add Members</h3>
              <p className="text-muted-foreground">
                Share the invite link or add placeholder users for people who haven&apos;t joined yet.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              3
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Track Expenses</h3>
              <p className="text-muted-foreground">
                Add expenses as they happen. Specify who paid and who participated.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              4
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">View Balances</h3>
              <p className="text-muted-foreground">
                Check who owes what and settle up based on the balance overview.
              </p>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}