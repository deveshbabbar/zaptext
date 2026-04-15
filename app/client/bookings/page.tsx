'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface BookingItem {
  booking_id: string;
  customer_name: string;
  customer_phone: string;
  date: string;
  time_slot: string;
  end_time: string;
  service: string;
  status: string;
  notes: string;
}

export default function ClientBookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client/bookings')
      .then((res) => res.json())
      .then((data) => { setBookings(data.bookings || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      setBookings((prev) => prev.map((b) => b.booking_id === bookingId ? { ...b, status: 'cancelled' } : b));
      toast.success('Booking cancelled');
    } catch {
      toast.error('Failed to cancel');
    }
  };

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-muted rounded-lg"></div></div>;

  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.date >= new Date().toISOString().split('T')[0]);
  const past = bookings.filter((b) => b.status === 'completed' || (b.status === 'confirmed' && b.date < new Date().toISOString().split('T')[0]));
  const cancelled = bookings.filter((b) => b.status === 'cancelled');

  const BookingList = ({ items }: { items: BookingItem[] }) => (
    items.length === 0 ? (
      <p className="text-muted-foreground text-center py-8">No bookings</p>
    ) : (
      <div className="space-y-3">
        {items.map((b) => (
          <div key={b.booking_id} className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium">{b.customer_name}</p>
              <p className="text-sm text-muted-foreground">{b.date} &middot; {b.time_slot} - {b.end_time}</p>
              {b.service && <p className="text-sm text-muted-foreground">{b.service}</p>}
              {b.notes && <p className="text-xs text-muted-foreground mt-1">{b.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Badge className={b.status === 'confirmed' ? 'bg-green-500/10 text-green-400' : b.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : 'bg-muted text-muted-foreground'}>
                {b.status}
              </Badge>
              {b.status === 'confirmed' && (
                <Button variant="outline" size="sm" onClick={() => handleCancel(b.booking_id)}>Cancel</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  );

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Bookings</h1>
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming"><Card><CardContent className="pt-4"><BookingList items={upcoming} /></CardContent></Card></TabsContent>
        <TabsContent value="past"><Card><CardContent className="pt-4"><BookingList items={past} /></CardContent></Card></TabsContent>
        <TabsContent value="cancelled"><Card><CardContent className="pt-4"><BookingList items={cancelled} /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
