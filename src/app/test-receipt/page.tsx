"use client";

import { useState } from "react";
import { MockReceiptClaimingInterface } from "@/components/groups/receipt-claiming-interface-mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Receipt, Settings, Play, Square } from "lucide-react";

export default function TestReceiptPage() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [merchantName, setMerchantName] = useState("Test Restaurant");
  const [itemCount, setItemCount] = useState(5);
  const [participantCount, setParticipantCount] = useState(3);

  const startSimulation = () => {
    setIsSimulating(true);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Receipt Test Environment</h1>
            <p className="text-muted-foreground">
              Test the live receipt claiming interface locally without needing real receipts
            </p>
          </div>
        </div>

        {!isSimulating ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Test Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="merchant">Merchant Name</Label>
                  <Input
                    id="merchant"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="Enter merchant name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="items">Number of Items</Label>
                  <Input
                    id="items"
                    type="number"
                    min="1"
                    max="20"
                    value={itemCount}
                    onChange={(e) => setItemCount(Number(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="participants">Number of Participants</Label>
                  <Input
                    id="participants"
                    type="number"
                    min="2"
                    max="10"
                    value={participantCount}
                    onChange={(e) => setParticipantCount(Number(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <Button onClick={startSimulation} className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Start Receipt Simulation
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>What this simulates:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Live receipt claiming interface</li>
                  <li>Real-time updates when items are claimed</li>
                  <li>Multiple participants (mix of users and placeholders)</li>
                  <li>Split items vs individual items</li>
                  <li>Session expiration countdown</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-green-600">
                    Simulation Active
                  </Badge>
                  <Button onClick={stopSimulation} variant="outline" size="sm">
                    <Square className="h-4 w-4 mr-2" />
                    Stop Simulation
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Mock Receipt Claiming Interface */}
            <MockReceiptClaimingInterface
              merchantName={merchantName}
              itemCount={itemCount}
              participantCount={participantCount}
              groupCurrency="USD"
            />
          </div>
        )}
      </div>
    </div>
  );
}