"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calculator, 
  Receipt, 
  TrendingDown,
  Clock,
  Shield,
  Smartphone,
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
            <span className="text-primary">Not Friendships</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Track shared expenses, calculate balances, and settle up with minimal transactions. 
            Perfect for trips, roommates, and group activities.
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
          <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            FairShare makes group expense tracking simple and transparent
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Group Management</h3>
            <p className="text-sm text-muted-foreground">
              Create groups and invite friends with a simple link. No complex setup required.
            </p>
          </div>
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Expense Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Log expenses, select participants, and let us calculate who owes what automatically.
            </p>
          </div>
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Smart Settlements</h3>
            <p className="text-sm text-muted-foreground">
              Minimize transactions with our optimized settlement algorithm. Settle up efficiently.
            </p>
          </div>
          <div className="p-6 border rounded-lg space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Activity History</h3>
            <p className="text-sm text-muted-foreground">
              Full transparency with a complete log of all expenses and changes in your group.
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
                Sign up and create a group for your trip, household, or any shared activity.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              2
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Invite Friends</h3>
              <p className="text-muted-foreground">
                Share the unique invite link. Friends can join instantly after signing up.
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
              <h3 className="font-semibold text-lg">Settle Up</h3>
              <p className="text-muted-foreground">
                View optimized settlement plans showing the minimum transactions needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-16 border-t">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Why Choose FairShare?</h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Smartphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Mobile-First Design</h3>
                  <p className="text-sm text-muted-foreground">
                    Optimized for smartphones so you can add expenses on the go.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <TrendingDown className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Minimize Transactions</h3>
                  <p className="text-sm text-muted-foreground">
                    Our algorithm finds the simplest way for everyone to settle up.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Secure & Private</h3>
                  <p className="text-sm text-muted-foreground">
                    Your data is protected and only visible to your group members.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-muted rounded-lg p-8 text-center">
            <div className="text-5xl font-bold text-primary mb-2">100%</div>
            <div className="text-xl font-semibold mb-4">Free to Use</div>
            <p className="text-muted-foreground">
              No hidden fees, no premium tiers. FairShare is completely free for all users.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-primary rounded-2xl p-8 md:p-12 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Simplify Group Expenses?
          </h2>
          <p className="text-lg mb-6 opacity-90 max-w-2xl mx-auto">
            Join thousands of groups already using FairShare to track and settle shared expenses.
          </p>
          {!session && (
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => {
                signIn.social({
                  provider: "google",
                  callbackURL: "/groups",
                });
              }}
            >
              Start for Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}