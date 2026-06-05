'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/volt/status-badge';
import { Spinner } from '@/components/ui/spinner';
import { 
  AdminDrawer,
  AdminDrawerHeader,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerSection,
  AdminDrawerFieldList,
  AdminDrawerField,
  AdminDrawerPanel,
} from '@/components/admin/admin-drawer';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminFilterBar, AdminFilterToggleGroup } from '@/components/admin/admin-filter-bar';
import {
  AdminDataTableCard,
  AdminDataTable,
  AdminDataTableHeader,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableCell,
  AdminDataTableEmpty,
  AdminMobileCardList,
  AdminMobileCard,
  AdminDesktopOnly,
} from '@/components/admin/admin-data-table';
import { AdminPaginationBar } from '@/components/admin/admin-pagination-bar';
import { AdminTableSkeleton, AdminCardListSkeleton } from '@/components/admin/admin-skeletons';
import { useSessions } from '@/hooks/use-services';
import { rentalService } from '@/lib/services';
import { downloadCsv } from '@/lib/admin/export-csv';
import { AdminErrorBanner } from '@/components/admin/admin-states';
import { toast } from '@/components/admin/admin-providers';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAdminPagination } from '@/hooks/use-admin-pagination';
import { useTableSort } from '@/hooks/use-table-sort';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isSuccessResponse } from '@/lib/api/client';
import type { RentalSession, TimelineEvent } from '@/lib/types';
import { formatDateTime, formatTime } from '@/lib/utils';
import { 
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
import { TableBody } from '@/components/ui/table';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
];

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

  const [actionLoading, setActionLoading] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<RentalSession | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = useAdminPagination();

  const { data: sessions, loading, error, total, fetchSessions, refetch } = useSessions();

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, statusFilter, resetPage]);

  useEffect(() => {
    const filters: Parameters<typeof fetchSessions>[0] = {
      ...paginationParams,
    };
    if (debouncedSearch) filters.search = debouncedSearch;
    if (statusFilter !== 'all') {
      filters.status = [statusFilter as RentalSession['status']];
    }
    fetchSessions(filters);
  }, [debouncedSearch, statusFilter, paginationParams, fetchSessions]);

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
  const { sorted: sortedSessions, sortOrder, toggleSort, isSorted } = useTableSort(
    filteredSessions,
    'startTime',
    'desc',
  );

  const handleExport = () => {
    downloadCsv(
      'powerdon-sessions.csv',
      ['sessionCode', 'userEmail', 'station', 'status', 'paymentStatus', 'amountCharged'],
      filteredSessions.map((s) => [
        s.sessionCode,
        s.userEmail,
        s.stationName,
        s.status,
        s.paymentStatus,
        s.amountCharged,
      ]),
    );
  };

  const handleCancelSession = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      const result = await rentalService.cancelSession(cancelTarget.id);
      if (result.success) {
        toast.success('Session cancelled');
        setCancelTarget(null);
        setSelectedSession(null);
        refetch();
      } else {
        toast.error(result.error?.message ?? 'Cancel failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const activeFilters =
    statusFilter !== 'all'
      ? [{ key: 'status', label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter('all') }]
      : [];

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Sessions"
        description="Monitor and manage all rental sessions"
        meta={
          total > 0 ? (
            <p className="text-xs text-muted-foreground">{total} total sessions</p>
          ) : null
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!filteredSessions.length}>
              <Download className="mr-2 size-4" aria-hidden />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 size-4" aria-hidden />
              Refresh
            </Button>
          </>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={() => refetch()} />}

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by session code, email, or name…"
        activeFilters={activeFilters}
        onClearFilters={searchQuery || statusFilter !== 'all' ? clearFilters : undefined}
      >
        <AdminFilterToggleGroup
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
        />
      </AdminFilterBar>

      <AdminDataTableCard>
        {loading ? (
          <>
            <AdminDesktopOnly>
              <AdminTableSkeleton rows={pageSize} columns={8} />
            </AdminDesktopOnly>
            <AdminCardListSkeleton count={5} />
          </>
        ) : filteredSessions.length === 0 ? (
          <AdminDataTableEmpty title="No sessions match your filters" />
        ) : (
          <>
            <AdminDesktopOnly>
              <AdminDataTable>
                <AdminDataTableHeader>
                  <AdminDataTableRow>
                    <AdminDataTableHead
                      sortable
                      sorted={isSorted('startTime') ? sortOrder : false}
                      onSort={() => toggleSort('startTime')}
                    >
                      Session
                    </AdminDataTableHead>
                    <AdminDataTableHead>User</AdminDataTableHead>
                    <AdminDataTableHead>Station</AdminDataTableHead>
                    <AdminDataTableHead>Duration</AdminDataTableHead>
                    <AdminDataTableHead>Status</AdminDataTableHead>
                    <AdminDataTableHead>Payment</AdminDataTableHead>
                    <AdminDataTableHead>Reward</AdminDataTableHead>
                    <AdminDataTableHead
                      sortable
                      sorted={isSorted('amountCharged') ? sortOrder : false}
                      onSort={() => toggleSort('amountCharged')}
                      className="text-right"
                    >
                      Amount
                    </AdminDataTableHead>
                  </AdminDataTableRow>
                </AdminDataTableHeader>
                <TableBody>
                  {sortedSessions.map((session) => (
                    <AdminDataTableRow key={session.id} onClick={() => setSelectedSession(session)}>
                      <AdminDataTableCell>
                        <div>
                          <p className="font-mono text-sm font-medium">{session.sessionCode}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(new Date(session.startTime))}
                          </p>
                        </div>
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        <div>
                          <p>{session.userName || 'Anonymous'}</p>
                          <p className="text-xs text-muted-foreground">{session.userEmail}</p>
                        </div>
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        <div>
                          <p>{session.stationName}</p>
                          <p className="text-xs text-muted-foreground">Slot {session.slotNumber}</p>
                        </div>
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        {session.durationMinutes
                          ? `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}m`
                          : 'In progress'}
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        <StatusBadge status={session.status} size="sm" />
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        <StatusBadge status={session.paymentStatus} size="sm" />
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        <StatusBadge status={session.rewardStatus} size="sm" />
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-right font-semibold tabular-nums">
                        €{session.amountCharged.toFixed(2)}
                      </AdminDataTableCell>
                    </AdminDataTableRow>
                  ))}
                </TableBody>
              </AdminDataTable>
            </AdminDesktopOnly>

            <AdminMobileCardList>
              {sortedSessions.map((session) => (
                <AdminMobileCard key={session.id} onClick={() => setSelectedSession(session)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold">{session.sessionCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(new Date(session.startTime))}
                      </p>
                    </div>
                    <StatusBadge status={session.status} size="sm" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">{session.userName || session.userEmail}</p>
                      <p className="text-xs text-muted-foreground">{session.stationName}</p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      €{session.amountCharged.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={session.paymentStatus} size="sm" />
                    <StatusBadge status={session.rewardStatus} size="sm" />
                  </div>
                </AdminMobileCard>
              ))}
            </AdminMobileCardList>

            <AdminPaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </AdminDataTableCard>

      {/* Session Detail Drawer */}
      <AdminDrawer
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
        size="wide"
      >
        {selectedSession && (
          <>
            <AdminDrawerHeader
              title={<span className="font-mono">{selectedSession.sessionCode}</span>}
              description={`Session started ${formatDateTime(new Date(selectedSession.startTime))}`}
            >
              <StatusBadge status={selectedSession.status} />
              <StatusBadge status={selectedSession.paymentStatus} />
              <StatusBadge status={selectedSession.rewardStatus} />
            </AdminDrawerHeader>

            <AdminDrawerBody>
              <AdminDrawerSection title="User Details" icon={User}>
                <AdminDrawerFieldList>
                  <AdminDrawerField
                    label="Name"
                    value={selectedSession.userName || 'Not provided'}
                  />
                  <AdminDrawerField label="Email" value={selectedSession.userEmail} />
                </AdminDrawerFieldList>
              </AdminDrawerSection>

              <AdminDrawerSection title="Session Details" icon={Clock}>
                <AdminDrawerFieldList>
                  <AdminDrawerField label="Station" value={selectedSession.stationName} />
                  <AdminDrawerField label="Slot" value={selectedSession.slotNumber} />
                  <AdminDrawerField
                    label="Duration"
                    value={
                      selectedSession.durationMinutes
                        ? `${Math.floor(selectedSession.durationMinutes / 60)}h ${selectedSession.durationMinutes % 60}m`
                        : 'In progress'
                    }
                  />
                  <AdminDrawerField label="Campaign" value={selectedSession.campaignName} />
                </AdminDrawerFieldList>
              </AdminDrawerSection>

              <AdminDrawerSection title="Payment Details" icon={CreditCard}>
                <AdminDrawerFieldList>
                  <AdminDrawerField label="Method" value={selectedSession.paymentMethod} />
                  <AdminDrawerField
                    label="Deposit"
                    value={`€${selectedSession.depositAmount.toFixed(2)}`}
                  />
                  <AdminDrawerField
                    label="Charged"
                    value={`€${selectedSession.amountCharged.toFixed(2)}`}
                  />
                  <AdminDrawerField
                    label="Refunded"
                    value={`€${selectedSession.amountRefunded.toFixed(2)}`}
                    valueClassName="text-emerald-600"
                  />
                </AdminDrawerFieldList>
              </AdminDrawerSection>

              {selectedSession.rewardCode && (
                <AdminDrawerSection title="Reward" icon={Gift}>
                  <AdminDrawerPanel className="font-mono text-sm font-semibold text-foreground">
                    {selectedSession.rewardCode}
                  </AdminDrawerPanel>
                </AdminDrawerSection>
              )}

              <AdminDrawerSection title="Session Timeline">
                {timelineLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Spinner />
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No timeline events recorded
                  </p>
                ) : (
                  <div className="space-y-1">
                    {timelineEvents.map((event, index) => {
                      const Icon = timelineIconMap[event.type] || CheckCircle;
                      return (
                        <div key={event.id} className="flex gap-3 rounded-lg px-1 py-2">
                          <div className="relative shrink-0">
                            <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                              <Icon size={14} className="text-muted-foreground" aria-hidden />
                            </div>
                            {index < timelineEvents.length - 1 && (
                              <div className="absolute left-1/2 top-8 h-6 w-px -translate-x-1/2 bg-border" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pb-3">
                            <p className="text-sm font-medium text-foreground">{event.description}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatTime(new Date(event.timestamp))}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AdminDrawerSection>
            </AdminDrawerBody>

            <AdminDrawerFooter align="stretch">
              {selectedSession.userEmail && (
                <Button variant="outline" className="flex-1 sm:flex-none" asChild>
                  <a href={`mailto:${selectedSession.userEmail}`}>Contact User</a>
                </Button>
              )}
              <Button variant="outline" className="flex-1 sm:flex-none" asChild>
                <Link href="/admin/billing">View in Billing</Link>
              </Button>
              {['pending', 'active'].includes(selectedSession.status) && (
                <Button
                  variant="destructive"
                  className="flex-1 sm:flex-none"
                  onClick={() => setCancelTarget(selectedSession)}
                >
                  Cancel Session
                </Button>
              )}
            </AdminDrawerFooter>
          </>
        )}
      </AdminDrawer>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel session?</DialogTitle>
            <DialogDescription>
              This releases the payment hold and marks session {cancelTarget?.sessionCode} as cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={actionLoading}>
              Keep session
            </Button>
            <Button variant="destructive" onClick={handleCancelSession} disabled={actionLoading}>
              {actionLoading ? 'Cancelling…' : 'Confirm cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
