'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PlanStat {
  name: string;
  price: number;
  activeCount: number;
  revenue: number;
}

interface SubscriptionItem {
  userId: string;
  plan: string;
  status: string;
  amount: number;
  startDate: string;
  endDate: string;
  businessNames: string[];
}

interface Data {
  planStats: PlanStat[];
  subscriptions: SubscriptionItem[];
  totalActive: number;
  totalMRR: number;
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/subscriptions')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  const planStats = data?.planStats || [];
  const subscriptions = data?.subscriptions || [];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Subscriptions</h1>
      <p className="text-muted-foreground mb-8">Manage client subscription plans</p>

      {/* Plan summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {planStats.map((p) => (
          <Card key={p.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <Badge variant="outline">
                  ₹{p.price.toLocaleString('en-IN')}/mo
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{p.activeCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue contribution</p>
                  <p className="text-lg font-semibold text-primary">
                    ₹{p.revenue.toLocaleString('en-IN')}/mo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscriptions table */}
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No paid subscriptions yet — clients on free trial
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s, i) => (
                  <TableRow key={`${s.userId}-${i}`}>
                    <TableCell className="font-medium">
                      {s.businessNames.join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.plan}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.startDate || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.endDate || '—'}
                    </TableCell>
                    <TableCell>₹{(s.amount || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          s.status === 'active'
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }
                      >
                        {s.status || 'unknown'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
