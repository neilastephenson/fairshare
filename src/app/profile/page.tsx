"use client";

import { useSession } from "@/lib/auth-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, Shield, ArrowLeft, CreditCard, Edit3, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState("");
  const [originalPaymentInfo, setOriginalPaymentInfo] = useState("");
  const [isLoadingPaymentInfo, setIsLoadingPaymentInfo] = useState(true);
  const [isSavingPaymentInfo, setIsSavingPaymentInfo] = useState(false);

  // Load payment info when component mounts
  useEffect(() => {
    const fetchPaymentInfo = async () => {
      if (!session?.user) return;

      try {
        const response = await fetch("/api/user/payment-info");
        if (response.ok) {
          const data = await response.json();
          setPaymentInfo(data.paymentInfo || "");
          setOriginalPaymentInfo(data.paymentInfo || "");
        }
      } catch (error) {
        console.error("Failed to fetch payment info:", error);
      } finally {
        setIsLoadingPaymentInfo(false);
      }
    };

    fetchPaymentInfo();
  }, [session?.user]);

  const savePaymentInfo = async () => {
    setIsSavingPaymentInfo(true);
    try {
      const response = await fetch("/api/user/payment-info", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentInfo }),
      });

      if (response.ok) {
        const data = await response.json();
        setOriginalPaymentInfo(data.paymentInfo || "");
        setIsEditingPayment(false);
        toast.success("Payment information updated successfully!");
      } else {
        throw new Error("Failed to update payment information");
      }
    } catch (error) {
      console.error("Error updating payment information:", error);
      toast.error("Failed to update payment information");
    } finally {
      setIsSavingPaymentInfo(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.push("/");
    return null;
  }

  const user = session.user;
  const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : null;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Your Profile</h1>
      </div>

      <div className="grid gap-6">
        {/* Profile Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Avatar className="h-20 w-20 mx-auto sm:mx-0">
                <AvatarImage
                  src={user.image || ""}
                  alt={user.name || "User"}
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="text-lg">
                  {(
                    user.name?.[0] ||
                    user.email?.[0] ||
                    "U"
                  ).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 w-full text-center sm:text-left">
                <h2 className="text-2xl font-semibold">{user.name}</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-muted-foreground">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <Mail className="h-4 w-4" />
                    <span className="break-all">{user.email}</span>
                  </div>
                  {user.emailVerified && (
                    <Badge variant="outline" className="text-green-600 border-green-600 w-fit mx-auto sm:mx-0">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                {createdDate && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center sm:justify-start">
                    <Calendar className="h-4 w-4" />
                    <span>Member since {createdDate}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your account details and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Full Name
                </label>
                <div className="p-3 border rounded-md bg-muted/10">
                  {user.name || "Not provided"}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Email Address
                </label>
                <div className="p-3 border rounded-md bg-muted/10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="break-all">{user.email}</span>
                    {user.emailVerified && (
                      <Badge variant="outline" className="text-green-600 border-green-600 w-fit">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Account Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="space-y-1">
                    <p className="font-medium">Email Verification</p>
                    <p className="text-sm text-muted-foreground">
                      Email address verification status
                    </p>
                  </div>
                  <Badge variant={user.emailVerified ? "default" : "secondary"} className="w-fit">
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="space-y-1">
                    <p className="font-medium">Account Type</p>
                    <p className="text-sm text-muted-foreground">
                      Your account access level
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit">Standard</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your recent account activity and sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-muted-foreground">Active now</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600 w-fit">
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Information
                </CardTitle>
                <CardDescription>
                  Add your preferred payment details for group settlements
                </CardDescription>
              </div>
              {!isEditingPayment && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setIsEditingPayment(true);
                    setOriginalPaymentInfo(paymentInfo);
                  }}
                  className="flex items-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingPaymentInfo ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading payment information...</div>
              </div>
            ) : isEditingPayment ? (
              <div className="space-y-4">
                <Textarea
                  placeholder="Enter your payment information (e.g., bank details, Venmo username, PayPal email, etc.)"
                  value={paymentInfo}
                  onChange={(e) => setPaymentInfo(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={savePaymentInfo}
                    disabled={isSavingPaymentInfo}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isSavingPaymentInfo ? "Saving..." : "Save"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setPaymentInfo(originalPaymentInfo);
                      setIsEditingPayment(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentInfo ? (
                  <div className="p-4 bg-muted/20 border rounded-lg">
                    <p className="whitespace-pre-wrap text-sm">{paymentInfo}</p>
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">No payment information added yet</p>
                    <p className="text-xs text-muted-foreground">
                      Add your bank details, Venmo, PayPal, or other payment info to make settlements easier
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}