"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/currency";
import { Users } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  userBalance: number;
}

interface GroupListProps {
  groups: Group[];
}

export function GroupList({ groups }: GroupListProps) {
  const getBalanceStatus = (netBalance: number) => {
    if (netBalance > 0.01) return 'owed'; // They are owed money
    if (netBalance < -0.01) return 'owes'; // They owe money
    return 'settled'; // Even
  };

  const getBalanceColor = (status: string) => {
    switch (status) {
      case 'owed':
        return 'text-green-600 dark:text-green-400';
      case 'owes':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return formatAmount(Math.abs(amount), 'GBP');
  };

  const getBalanceText = (netBalance: number) => {
    const status = getBalanceStatus(netBalance);
    if (status === 'settled') return 'You are even';
    if (status === 'owed') return `You are owed ${formatCurrency(netBalance)}`;
    return `You owe ${formatCurrency(netBalance)}`;
  };

  return (
    <div className="grid gap-4">
      {groups.map((group) => {
        const status = getBalanceStatus(group.userBalance);
        return (
          <Link key={group.id} href={`/groups/${group.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold truncate">
                      {group.name}
                    </CardTitle>
                    <div className={`text-sm font-medium ${getBalanceColor(status)}`}>
                      {getBalanceText(group.userBalance)}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}