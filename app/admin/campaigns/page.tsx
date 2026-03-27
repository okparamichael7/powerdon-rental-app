'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCampaigns, useCreateCampaign, useUpdateCampaign } from '@/hooks/use-services';
import type { Campaign } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { 
  Plus, 
  Edit, 
  Calendar, 
  Euro, 
  Gift, 
  Clock,
  Target,
  Zap,
  MoreVertical,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function CampaignsPage() {
  const { data: campaigns, loading, error, fetchCampaigns, refetch } = useCampaigns();
  const { createCampaign, loading: creating } = useCreateCampaign();
  const { updateCampaign, loading: updating } = useUpdateCampaign();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  // Form state for create
  const [createForm, setCreateForm] = useState({
    name: '',
    eventName: '',
    startDate: '',
    endDate: '',
    hourlyRate: '2.00',
    dailyCap: '10.00',
    depositAmount: '25.00',
    rewardThresholdMinutes: '60',
    rewardValue: '10.00',
    rewardDescription: '',
  });

  // Form state for edit
  const [editForm, setEditForm] = useState({
    name: '',
    eventName: '',
    hourlyRate: '',
    dailyCap: '',
    depositAmount: '',
    rewardThresholdMinutes: '',
    rewardValue: '',
    rewardDescription: '',
  });

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedCampaign) {
      setEditForm({
        name: selectedCampaign.name,
        eventName: selectedCampaign.eventName,
        hourlyRate: String(selectedCampaign.hourlyRate),
        dailyCap: String(selectedCampaign.dailyCap),
        depositAmount: String(selectedCampaign.depositAmount),
        rewardThresholdMinutes: String(selectedCampaign.rewardThresholdMinutes),
        rewardValue: String(selectedCampaign.rewardValue),
        rewardDescription: selectedCampaign.rewardDescription,
      });
    }
  }, [selectedCampaign]);

  const handleCreateCampaign = async () => {
    const result = await createCampaign({
      name: createForm.name,
      eventName: createForm.eventName,
      startDate: new Date(createForm.startDate),
      endDate: new Date(createForm.endDate),
      hourlyRate: parseFloat(createForm.hourlyRate),
      dailyCap: parseFloat(createForm.dailyCap),
      depositAmount: parseFloat(createForm.depositAmount),
      rewardThresholdMinutes: parseInt(createForm.rewardThresholdMinutes),
      rewardType: 'voucher',
      rewardValue: parseFloat(createForm.rewardValue),
      rewardDescription: createForm.rewardDescription,
    });
    
    if (result) {
      setShowCreateDialog(false);
      setCreateForm({
        name: '',
        eventName: '',
        startDate: '',
        endDate: '',
        hourlyRate: '2.00',
        dailyCap: '10.00',
        depositAmount: '25.00',
        rewardThresholdMinutes: '60',
        rewardValue: '10.00',
        rewardDescription: '',
      });
      refetch();
    }
  };

  const handleUpdateCampaign = async () => {
    if (!selectedCampaign) return;
    
    const result = await updateCampaign(selectedCampaign.id, {
      name: editForm.name,
      eventName: editForm.eventName,
      hourlyRate: parseFloat(editForm.hourlyRate),
      dailyCap: parseFloat(editForm.dailyCap),
      depositAmount: parseFloat(editForm.depositAmount),
      rewardThresholdMinutes: parseInt(editForm.rewardThresholdMinutes),
      rewardValue: parseFloat(editForm.rewardValue),
      rewardDescription: editForm.rewardDescription,
    });
    
    if (result) {
      setSelectedCampaign(null);
      refetch();
    }
  };

  // Loading state
  if (loading && !campaigns?.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Spinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !campaigns?.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Failed to Load Campaigns</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => refetch()}>
                <RefreshCw size={16} className="mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!campaigns?.length) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground">
              Create and manage reward campaigns for your events
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus size={16} className="mr-2" />
            New Campaign
          </Button>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No Campaigns Yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Create your first campaign to start rewarding customers for renting power banks at your events.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus size={16} className="mr-2" />
                Create Campaign
              </Button>
            </div>
          </CardContent>
        </Card>

        <CreateCampaignDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          form={createForm}
          setForm={setCreateForm}
          onSubmit={handleCreateCampaign}
          loading={creating}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage reward campaigns for your events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin mr-2' : 'mr-2'} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus size={16} className="mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Campaign Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onEdit={() => setSelectedCampaign(campaign)}
          />
        ))}
      </div>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreateCampaign}
        loading={creating}
      />

      {/* Edit Campaign Dialog */}
      <EditCampaignDialog
        campaign={selectedCampaign}
        onOpenChange={() => setSelectedCampaign(null)}
        form={editForm}
        setForm={setEditForm}
        onSubmit={handleUpdateCampaign}
        loading={updating}
      />
    </div>
  );
}

// Campaign Card Component
function CampaignCard({ 
  campaign, 
  onEdit 
}: { 
  campaign: Campaign; 
  onEdit: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      {/* Active Indicator */}
      {campaign.isActive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
      )}
      
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              {campaign.isActive ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
              ) : (
                <Badge variant="secondary">Ended</Badge>
              )}
            </div>
            <CardDescription>{campaign.eventName}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <MoreVertical size={16} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Date Range */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar size={14} />
          <span>
            {formatDate(new Date(campaign.startDate))} - {formatDate(new Date(campaign.endDate))}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Euro size={14} />
              <span className="text-xs font-medium">Pricing</span>
            </div>
            <p className="text-lg font-bold text-foreground">{campaign.hourlyRate}/hr</p>
            <p className="text-xs text-muted-foreground">{campaign.dailyCap} daily cap</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Euro size={14} />
              <span className="text-xs font-medium">Deposit</span>
            </div>
            <p className="text-lg font-bold text-foreground">{campaign.depositAmount}</p>
            <p className="text-xs text-muted-foreground">Refundable</p>
          </div>
        </div>

        {/* Reward Details */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Gift size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Reward Configuration</p>
              <p className="text-sm text-muted-foreground mt-1">
                {campaign.rewardDescription}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>{campaign.rewardThresholdMinutes} min threshold</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Target size={12} />
                  <span>{campaign.rewardValue} value</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Zap size={14} />
              <span className="text-xs">Sessions</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{formatNumber(campaign.totalSessions)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Gift size={14} />
              <span className="text-xs">Rewards Issued</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{formatNumber(campaign.totalRewardsIssued)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onEdit}>
            <Edit size={14} className="mr-2" />
            Edit
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <a href="/admin/analytics">View Analytics</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Create Campaign Dialog
function CreateCampaignDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    name: string;
    eventName: string;
    startDate: string;
    endDate: string;
    hourlyRate: string;
    dailyCap: string;
    depositAmount: string;
    rewardThresholdMinutes: string;
    rewardValue: string;
    rewardDescription: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSubmit: () => void;
  loading: boolean;
}) {
  const isValid = form.name && form.eventName && form.startDate && form.endDate && form.rewardDescription;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Set up a new reward campaign for your event
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Campaign Name</label>
            <Input 
              placeholder="e.g., Summer Festival Rewards"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Event Name</label>
            <Input 
              placeholder="e.g., Coachella 2025"
              value={form.eventName}
              onChange={(e) => setForm(f => ({ ...f, eventName: e.target.value }))}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Start Date</label>
              <Input 
                type="date"
                value={form.startDate}
                onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">End Date</label>
              <Input 
                type="date"
                value={form.endDate}
                onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Hourly Rate</label>
              <Input 
                type="number" 
                placeholder="2.00" 
                step="0.50"
                value={form.hourlyRate}
                onChange={(e) => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Daily Cap</label>
              <Input 
                type="number" 
                placeholder="10.00"
                value={form.dailyCap}
                onChange={(e) => setForm(f => ({ ...f, dailyCap: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Deposit</label>
              <Input 
                type="number" 
                placeholder="25.00"
                value={form.depositAmount}
                onChange={(e) => setForm(f => ({ ...f, depositAmount: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="font-medium text-foreground mb-3">Reward Configuration</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Threshold (min)</label>
                <Input 
                  type="number" 
                  placeholder="60"
                  value={form.rewardThresholdMinutes}
                  onChange={(e) => setForm(f => ({ ...f, rewardThresholdMinutes: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Reward Value</label>
                <Input 
                  type="number" 
                  placeholder="10.00"
                  value={form.rewardValue}
                  onChange={(e) => setForm(f => ({ ...f, rewardValue: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium text-foreground">Reward Description</label>
              <Input 
                placeholder="e.g., 10 voucher for official merchandise"
                value={form.rewardDescription}
                onChange={(e) => setForm(f => ({ ...f, rewardDescription: e.target.value }))}
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading || !isValid}>
            {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Create Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Campaign Dialog
function EditCampaignDialog({
  campaign,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  loading,
}: {
  campaign: Campaign | null;
  onOpenChange: () => void;
  form: {
    name: string;
    eventName: string;
    hourlyRate: string;
    dailyCap: string;
    depositAmount: string;
    rewardThresholdMinutes: string;
    rewardValue: string;
    rewardDescription: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSubmit: () => void;
  loading: boolean;
}) {
  const isValid = form.name && form.eventName && form.rewardDescription;

  return (
    <Dialog open={!!campaign} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>
            Update campaign settings for {campaign?.name}
          </DialogDescription>
        </DialogHeader>
        
        {campaign && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Campaign Name</label>
              <Input 
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Event Name</label>
              <Input 
                value={form.eventName}
                onChange={(e) => setForm(f => ({ ...f, eventName: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hourly Rate</label>
                <Input 
                  type="number" 
                  step="0.50"
                  value={form.hourlyRate}
                  onChange={(e) => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Daily Cap</label>
                <Input 
                  type="number"
                  value={form.dailyCap}
                  onChange={(e) => setForm(f => ({ ...f, dailyCap: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Deposit</label>
                <Input 
                  type="number"
                  value={form.depositAmount}
                  onChange={(e) => setForm(f => ({ ...f, depositAmount: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="font-medium text-foreground mb-3">Reward Configuration</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Threshold (min)</label>
                  <Input 
                    type="number"
                    value={form.rewardThresholdMinutes}
                    onChange={(e) => setForm(f => ({ ...f, rewardThresholdMinutes: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Reward Value</label>
                  <Input 
                    type="number"
                    value={form.rewardValue}
                    onChange={(e) => setForm(f => ({ ...f, rewardValue: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <label className="text-sm font-medium text-foreground">Reward Description</label>
                <Input 
                  value={form.rewardDescription}
                  onChange={(e) => setForm(f => ({ ...f, rewardDescription: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading || !isValid}>
            {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
