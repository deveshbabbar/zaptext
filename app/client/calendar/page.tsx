'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Override {
  date: string;
  override_type: string;
  reason: string;
}

interface BookingItem {
  date: string;
  time_slot: string;
  end_time: string;
  customer_name: string;
  service: string;
  status: string;
}

export default function CalendarPage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/client/date-overrides').then((r) => r.json()),
      fetch('/api/client/bookings').then((r) => r.json()),
    ]).then(([ovData, bkData]) => {
      setOverrides(ovData.overrides || []);
      setBookings(bkData.bookings || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Calendar helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const formatDate = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isBlocked = (dateStr: string) => overrides.some((o) => o.date === dateStr && o.override_type === 'blocked');
  const getBookingsForDay = (dateStr: string) => bookings.filter((b) => b.date === dateStr && b.status === 'confirmed');
  const getOverride = (dateStr: string) => overrides.find((o) => o.date === dateStr);

  const handleBlockDate = async () => {
    if (!selectedDate) return;
    try {
      await fetch('/api/client/date-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, override_type: 'blocked', reason: blockReason }),
      });
      setOverrides((prev) => [...prev, { date: selectedDate, override_type: 'blocked', reason: blockReason }]);
      setBlockReason('');
      setShowBlockForm(false);
      toast.success('Date blocked!');
    } catch {
      toast.error('Failed to block date');
    }
  };

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-muted rounded-lg"></div></div>;

  const selectedBookings = selectedDate ? getBookingsForDay(selectedDate) : [];
  const selectedOverride = selectedDate ? getOverride(selectedDate) : null;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Calendar</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={prevMonth}>&larr;</Button>
                <CardTitle className="text-xl">{MONTHS[month]} {year}</CardTitle>
                <Button variant="outline" size="sm" onClick={nextMonth}>&rarr;</Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 rounded-lg"></div>
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDate(day);
                  const blocked = isBlocked(dateStr);
                  const dayBookings = getBookingsForDay(dateStr);
                  const isToday = dateStr === today;
                  const isSelected = dateStr === selectedDate;
                  const isPast = dateStr < today;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`h-20 rounded-lg border text-left p-1.5 transition-all relative
                        ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}
                        ${blocked ? 'bg-red-500/10' : 'hover:border-primary/50'}
                        ${isToday ? 'bg-primary/10' : ''}
                        ${isPast ? 'opacity-50' : ''}
                      `}
                    >
                      <span className={`text-sm font-medium ${isToday ? 'text-primary' : ''} ${blocked ? 'text-red-400 line-through' : ''}`}>
                        {day}
                      </span>
                      {blocked && (
                        <div className="text-[10px] text-red-400 mt-0.5">Blocked</div>
                      )}
                      {dayBookings.length > 0 && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5">
                          <div className="text-[10px] bg-primary/20 text-primary rounded px-1 py-0.5 text-center font-medium">
                            {dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30"></div>
                  Today
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-500/10 border border-red-500/30"></div>
                  Blocked
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/20"></div>
                  Has Bookings
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Details */}
        <div className="space-y-4">
          {selectedDate ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedOverride?.override_type === 'blocked' ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="text-sm font-medium text-red-400">Day Blocked</p>
                      {selectedOverride.reason && (
                        <p className="text-xs text-muted-foreground mt-1">{selectedOverride.reason}</p>
                      )}
                    </div>
                  ) : selectedBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bookings</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedBookings.map((b, i) => (
                        <div key={i} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{b.customer_name}</p>
                            <span className="text-xs text-primary font-medium">{b.time_slot} - {b.end_time}</span>
                          </div>
                          {b.service && <p className="text-xs text-muted-foreground mt-1">{b.service}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Block/Unblock */}
              {!isBlocked(selectedDate) && selectedDate >= today && (
                <Card>
                  <CardContent className="pt-4">
                    {showBlockForm ? (
                      <div className="space-y-3">
                        <Input
                          placeholder="Reason (optional)"
                          value={blockReason}
                          onChange={(e) => setBlockReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleBlockDate} className="flex-1 bg-red-500 hover:bg-red-600">
                            Block This Day
                          </Button>
                          <Button variant="outline" onClick={() => setShowBlockForm(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => setShowBlockForm(true)}>
                        Block This Day
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p className="text-4xl mb-2">📆</p>
                <p className="text-sm">Click on a date to see details</p>
              </CardContent>
            </Card>
          )}

          {/* Blocked dates list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Blocked Dates</CardTitle>
            </CardHeader>
            <CardContent>
              {overrides.filter((o) => o.override_type === 'blocked' && o.date >= today).length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming blocked dates</p>
              ) : (
                <div className="space-y-2">
                  {overrides.filter((o) => o.override_type === 'blocked' && o.date >= today).map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium">{o.date}</span>
                        {o.reason && <span className="text-muted-foreground ml-2">- {o.reason}</span>}
                      </div>
                      <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded">Blocked</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
