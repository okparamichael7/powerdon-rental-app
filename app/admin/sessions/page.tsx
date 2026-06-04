'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/volt/status-badge';
import { Spinner } from '@/components/ui/spinner';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useSessions } from '@/hooks/use-services';
import { rentalService } from '@/lib/services';
import { isSuccessResponse } from '@/lib/api/client';
import type { RentalSession, TimelineEvent } from '@/lib/types';
import { formatDateTime, formatTime } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  Download,
  Clock,
  CreditCard,
  Gift,
  MapPin,
  User,
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const timelineIconMap: Record<string, typeof Zap> = {
  scan: Zap,
  auth: User,
  payment: CreditCard,
  unlock: Zap,
  return: MapPin,
  reward: Gift,
  refund: RefreshCw,
  error: XCircle,
};

export default function SessionsPage() {
  const [selectedSession, setSelectedSession] = useState<RentalSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const { data: sessions, loading, fetchSessions, refetch } = useSessions();

  // Fetch sessions with filters
  useEffect(() => {
    const filters: Parameters<typeof fetchSessions>[0] = {};
    
    if (searchQuery) {
      filters.search = searchQuery;
    }
    
    if (statusFilter !== 'all') {
      filters.status = [statusFilter as RentalSession['status']];
    }

    fetchSessions(filters);
  }, [searchQuery, statusFilter, fetchSessions]);

  // Load timeline when session is selected
  useEffect(() => {
    async function loadTimeline() {
      if (!selectedSession) return;
      
      setTimelineLoading(true);
      try {
        const response = await rentalService.getSessionTimeline(selectedSession.id);
        if (isSuccessResponse(response)) {
          setTimelineEvents(response.data);
        }
      } finally {
        setTimelineLoading(false);
      }
    }
    loadTimeline();
  }, [selectedSession?.id]);

  const filteredSessions = sessions || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sessions</h1>
          <p className="text-muted-foreground">
            Monitor and manage all rental sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download size={16} className="mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by session code, email, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === 'expired' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('expired')}
              >
                Expired
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Session
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Station
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Payment
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Reward
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSessions.map((session) => (
                      <tr
                        key={session.id}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedSession(session)}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-foreground font-mono text-sm">
                              {session.sessionCode}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(new Date(session.startTime))}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-foreground">{session.userName || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground">{session.userEmail}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-foreground">{session.stationName}</p>
                            <p className="text-xs text-muted-foreground">Slot {session.slotNumber}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-foreground">
                            {session.durationMinutes
                              ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m`
                              : 'In progress'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={session.status} size="sm" />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={session.paymentStatus} size="sm" />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={session.rewardStatus} size="sm" />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-semibold text-foreground">
                            €{session.amountCharged.toFixed(2)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-border">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {session.sessionCode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(new Date(session.startTime))}
                        </p>
                      </div>
                      <StatusBadge status={session.status} size="sm" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-foreground">{session.userName || session.userEmail}</p>
                        <p className="text-xs text-muted-foreground">{session.stationName}</p>
                      </div>
                      <p className="text-lg font-bold text-foreground">€{session.amountCharged.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={session.paymentStatus} size="sm" />
                      <StatusBadge status={session.rewardStatus} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Session Detail Drawer */}
      <Sheet open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedSession && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{selectedSession.sessionCode}</SheetTitle>
                <SheetDescription>
                  Session started {formatDateTime(new Date(selectedSession.startTime))}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status Overview */}
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selectedSession.status} />
                  <StatusBadge status={selectedSession.paymentStatus} />
                  <StatusBadge status={selectedSession.rewardStatus} />
                </div>

                {/* User Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User size={16} />
                      User Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Name</span>
                      <span className="text-sm font-medium">{selectedSession.userName || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-sm font-medium">{selectedSession.userEmail}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Session Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock size={16} />
                      Session Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Station</span>
                      <span className="text-sm font-medium">{selectedSession.stationName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Slot</span>
                      <span className="text-sm font-medium">{selectedSession.slotNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Duration</span>
                      <span className="text-sm font-medium">
                        {selectedSession.durationMinutes
                          ? `${Math.floor(selectedSession.durationMinutes / 60)}h ${selectedSession.durationMinutes % 60}m`
                          : 'In progress'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Campaign</span>
                      <span className="text-sm font-medium">{selectedSession.campaignName}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CreditCard size={16} />
                      Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Method</span>
                      <span className="text-sm font-medium">{selectedSession.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Deposit</span>
                      <span className="text-sm font-medium">€{selectedSession.depositAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Charged</span>
                      <span className="text-sm font-medium text-foreground">€{selectedSession.amountCharged.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Refunded</span>
                      <span className="text-sm font-medium text-emerald-600">€{selectedSession.amountRefunded.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Reward Info */}
                {selectedSession.rewardCode && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Gift size={16} />
                        Reward
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-mono font-semibold text-foreground">{selectedSession.rewardCode}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timeline */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Session Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {timelineLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <Spinner />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {timelineEvents.map((event, index) => {
                          const Icon = timelineIconMap[event.type] || CheckCircle;
                          return (
                            <div key={event.id} className="flex gap-3">
                              <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                  <Icon size={14} className="text-muted-foreground" />
                                </div>
                                {index < timelineEvents.length - 1 && (
                                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-6 bg-border" />
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <p className="text-sm font-medium text-foreground">{event.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTime(new Date(event.timestamp))}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    Contact User
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Issue Refund
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
