"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  role: string;
}

interface GroupListProps {
  groups: Group[];
}

export function GroupList({ groups }: GroupListProps) {
  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <Link key={group.id} href={`/groups/${group.id}`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {group.name}
                    {group.role === "admin" && (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                  </CardTitle>
                  {group.description && (
                    <CardDescription>{group.description}</CardDescription>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Created {formatDistanceToNow(group.createdAt, { addSuffix: true })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}