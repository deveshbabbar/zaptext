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

interface ChartPoint {
  month: string;
  value: number;
}

interface RecentSub {
  userId: string;
  plan: string;
  status: string;
  amount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  businessNames: string[];
}

interface RevenueData {
  mrr: number;
  totalRevenue: number;
  activeCount: number;
  churnRate: number;
  chart: ChartPoint[];
  recent: RecentSub[];
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/revenue')
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

  const mrr = data?.mrr || 0;
  const totalRevenue = data?.totalRevenue || 0;
  const activeCount = data?.activeCount || 0;
  const churnRate = data?.churnRate || 0;
  const chartData = data?.chart || [];
  const recent = data?.recent || [];
  const chartMax = Math.max(1, ...chartData.map((d) => d.value));

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Revenue</h1>
      <p className="text-muted-foreground mb-8">Track subscriptions and earnings</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">MRR</p>
            <p className="text-3xl font-bold">₹{mrr.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">Monthly recurring</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-bold">₹{totalRevenue.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            <p className="text-3xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Churn Rate</p>
            <p className="text-3xl font-bold">{churnRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Revenue Growth (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 h-48 mt-4">
            {chartData.map((d) => {
              const h = (d.value / chartMax) * 100;
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    ₹{d.value.toLocaleString('en-IN')}
                  </div>
                  <div className="w-full bg-muted rounded-md flex items-end h-full overflow-hidden">
                    <div
                      className="w-full bg-primary rounded-md transition-all"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium">{d.month}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r, i) => (
                  <TableRow key={`${r.userId}-${i}`}>
                    <TableCell className="font-medium">
                      {r.businessNames.join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.plan}</Badge>
                    </TableCell>
                    <TableCell>₹{(r.amount || 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.createdAt || r.startDate || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          r.status === 'active'
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }
                      >
                        {r.status || 'unknown'}
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
