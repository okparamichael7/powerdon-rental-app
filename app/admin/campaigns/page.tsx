"use client";

import { useState, useEffect } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Spinner } from "@/components/ui/spinner";

import {
  AdminDrawer,
  AdminDrawerHeader,
  AdminDrawerFormBody,
  AdminDrawerFormSection,
  AdminDrawerFormField,
  AdminDrawerFormRow,
  AdminDrawerFooter,
} from "@/components/admin/admin-drawer";

import { AdminPageHeader } from "@/components/admin/admin-page-header";

import {
  AdminErrorBanner,
  AdminEmptyState,
} from "@/components/admin/admin-states";
import { AdminCardGridSkeleton } from "@/components/admin/admin-skeletons";

import { StatusBadge } from "@/components/volt/status-badge";

import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
} from "@/hooks/use-services";

import { campaignService } from "@/lib/services";

import { isSuccessResponse } from "@/lib/api/client";

import type { Campaign } from "@/lib/types";

import { formatDate, formatNumber } from "@/lib/utils";

import {
  Plus,
  Edit,
  Calendar,
  Euro,
  Gift,
  Clock,
  Target,
  Zap,
  RefreshCw,
} from "lucide-react";

export default function CampaignsPage() {
  const {
    data: campaigns,
    loading,
    error,
    fetchCampaigns,
    refetch,
  } = useCampaigns();

  const { createCampaign, loading: creating } = useCreateCampaign();

  const { updateCampaign, loading: updating } = useUpdateCampaign();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );

  // Form state for create

  const [createForm, setCreateForm] = useState({
    name: "",

    eventName: "",

    startDate: "",

    endDate: "",

    hourlyRate: "2.00",

    dailyCap: "10.00",

    depositAmount: "25.00",

    rewardThresholdMinutes: "60",

    rewardValue: "10.00",

    rewardDescription: "",
  });

  // Form state for edit

  const [editForm, setEditForm] = useState({
    name: "",

    eventName: "",

    hourlyRate: "",

    dailyCap: "",

    depositAmount: "",

    rewardThresholdMinutes: "",

    rewardValue: "",

    rewardDescription: "",
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

      rewardType: "voucher",

      rewardValue: parseFloat(createForm.rewardValue),

      rewardDescription: createForm.rewardDescription,

      stationIds: [],
    });

    if (result) {
      setShowCreateDialog(false);

      setCreateForm({
        name: "",

        eventName: "",

        startDate: "",

        endDate: "",

        hourlyRate: "2.00",

        dailyCap: "10.00",

        depositAmount: "25.00",

        rewardThresholdMinutes: "60",

        rewardValue: "10.00",

        rewardDescription: "",
      });

      refetch();
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    const result = await campaignService.toggleCampaignActive(
      campaign.id,
      !campaign.isActive,
    );

    if (isSuccessResponse(result)) refetch();
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

  const headerActions = (
    <>
      {campaigns && campaigns.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin mr-2" : "mr-2"}
          />
          Refresh
        </Button>
      )}

      <Button size="sm" onClick={() => setShowCreateDialog(true)}>
        <Plus size={16} className="mr-2" />
        New Campaign
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Campaigns"
        description="Create and manage reward campaigns for your events"
        meta={
          campaigns && campaigns.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
            </p>
          ) : null
        }
        actions={headerActions}
      />

      {error && <AdminErrorBanner message={error} onRetry={() => refetch()} />}

      {loading && !campaigns?.length ? (
        <AdminCardGridSkeleton count={6} />
      ) : !campaigns?.length ? (
        <Card>
          <CardContent>
            <AdminEmptyState
              title="No campaigns yet"
              description="Create your first campaign to start rewarding customers for renting power banks at your events."
              action={
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus size={16} className="mr-2" />
                  Create Campaign
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => setSelectedCampaign(campaign)}
              onToggleActive={() => handleToggleActive(campaign)}
            />
          ))}
        </div>
      )}

      <CreateCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreateCampaign}
        loading={creating}
      />

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

function CampaignCard({
  campaign,

  onEdit,

  onToggleActive,
}: {
  campaign: Campaign;

  onEdit: () => void;

  onToggleActive: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      {campaign.isActive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
      )}

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{campaign.name}</CardTitle>

              <StatusBadge
                status={campaign.isActive ? "live" : "ended"}
                size="sm"
              />
            </div>

            <CardDescription>{campaign.eventName}</CardDescription>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label="Edit campaign"
          >
            <Edit size={16} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar size={14} />

          <span>
            {formatDate(new Date(campaign.startDate))} -{" "}
            {formatDate(new Date(campaign.endDate))}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Euro size={14} />

              <span className="text-xs font-medium">Pricing</span>
            </div>

            <p className="text-lg font-bold text-foreground">
              {campaign.hourlyRate}/hr
            </p>

            <p className="text-xs text-muted-foreground">
              {campaign.dailyCap} daily cap
            </p>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Euro size={14} />

              <span className="text-xs font-medium">Deposit</span>
            </div>

            <p className="text-lg font-bold text-foreground">
              {campaign.depositAmount}
            </p>

            <p className="text-xs text-muted-foreground">Refundable</p>
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Gift size={16} className="text-primary" />
            </div>

            <div className="flex-1">
              <p className="font-medium text-foreground">
                Reward Configuration
              </p>

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

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Zap size={14} />

              <span className="text-xs">Sessions</span>
            </div>

            <p className="text-xl font-semibold text-foreground">
              {formatNumber(campaign.totalSessions)}
            </p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Gift size={14} />

              <span className="text-xs">Rewards Issued</span>
            </div>

            <p className="text-xl font-semibold text-foreground">
              {formatNumber(campaign.totalRewardsIssued)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onEdit}>
            <Edit size={14} className="mr-2" />
            Edit
          </Button>

          <Button
            variant={campaign.isActive ? "secondary" : "default"}
            className="flex-1"
            onClick={onToggleActive}
          >
            {campaign.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const isValid =
    form.name &&
    form.eventName &&
    form.startDate &&
    form.endDate &&
    form.rewardDescription;

  return (
    <AdminDrawer open={open} onOpenChange={onOpenChange} size="form">
      <AdminDrawerHeader
        title="Create New Campaign"
        description="Set up a new reward campaign for your event"
      />

      <AdminDrawerFormBody>
        <AdminDrawerFormSection title="Campaign Details" bordered={false}>
          <AdminDrawerFormField label="Campaign Name">
            <Input
              placeholder="e.g., Summer Festival Rewards"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </AdminDrawerFormField>

          <AdminDrawerFormField label="Event Name">
            <Input
              placeholder="e.g., Coachella 2025"
              value={form.eventName}
              onChange={(e) =>
                setForm((f) => ({ ...f, eventName: e.target.value }))
              }
            />
          </AdminDrawerFormField>

          <AdminDrawerFormRow>
            <AdminDrawerFormField label="Start Date">
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </AdminDrawerFormField>

            <AdminDrawerFormField label="End Date">
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </AdminDrawerFormField>
          </AdminDrawerFormRow>
        </AdminDrawerFormSection>

        <AdminDrawerFormSection title="Pricing">
          <AdminDrawerFormRow columns={3}>
            <AdminDrawerFormField label="Hourly Rate">
              <Input
                type="number"
                placeholder="2.00"
                step="0.50"
                value={form.hourlyRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                }
              />
            </AdminDrawerFormField>

            <AdminDrawerFormField label="Daily Cap">
              <Input
                type="number"
                placeholder="10.00"
                value={form.dailyCap}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dailyCap: e.target.value }))
                }
              />
            </AdminDrawerFormField>

            <AdminDrawerFormField label="Deposit">
              <Input
                type="number"
                placeholder="25.00"
                value={form.depositAmount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, depositAmount: e.target.value }))
                }
              />
            </AdminDrawerFormField>
          </AdminDrawerFormRow>
        </AdminDrawerFormSection>

        <AdminDrawerFormSection title="Reward Configuration">
          <AdminDrawerFormRow>
            <AdminDrawerFormField label="Threshold (min)">
              <Input
                type="number"
                placeholder="60"
                value={form.rewardThresholdMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rewardThresholdMinutes: e.target.value,
                  }))
                }
              />
            </AdminDrawerFormField>

            <AdminDrawerFormField label="Reward Value">
              <Input
                type="number"
                placeholder="10.00"
                value={form.rewardValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rewardValue: e.target.value }))
                }
              />
            </AdminDrawerFormField>
          </AdminDrawerFormRow>

          <AdminDrawerFormField label="Reward Description">
            <Input
              placeholder="e.g., 10 voucher for official merchandise"
              value={form.rewardDescription}
              onChange={(e) =>
                setForm((f) => ({ ...f, rewardDescription: e.target.value }))
              }
            />
          </AdminDrawerFormField>
        </AdminDrawerFormSection>
      </AdminDrawerFormBody>

      <AdminDrawerFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Cancel
        </Button>

        <Button onClick={onSubmit} disabled={loading || !isValid}>
          {loading ? <Spinner className="mr-2 size-4" /> : null}
          Create Campaign
        </Button>
      </AdminDrawerFooter>
    </AdminDrawer>
  );
}

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
    <AdminDrawer
      open={!!campaign}
      onOpenChange={(open) => !open && onOpenChange()}
      size="form"
    >
      <AdminDrawerHeader
        title="Edit Campaign"
        description={
          campaign ? `Update campaign settings for ${campaign.name}` : undefined
        }
      />

      {campaign && (
        <>
          <AdminDrawerFormBody>
            <AdminDrawerFormSection title="Campaign Details" bordered={false}>
              <AdminDrawerFormField label="Campaign Name">
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </AdminDrawerFormField>

              <AdminDrawerFormField label="Event Name">
                <Input
                  value={form.eventName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, eventName: e.target.value }))
                  }
                />
              </AdminDrawerFormField>
            </AdminDrawerFormSection>

            <AdminDrawerFormSection title="Pricing">
              <AdminDrawerFormRow columns={3}>
                <AdminDrawerFormField label="Hourly Rate">
                  <Input
                    type="number"
                    step="0.50"
                    value={form.hourlyRate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                    }
                  />
                </AdminDrawerFormField>

                <AdminDrawerFormField label="Daily Cap">
                  <Input
                    type="number"
                    value={form.dailyCap}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dailyCap: e.target.value }))
                    }
                  />
                </AdminDrawerFormField>

                <AdminDrawerFormField label="Deposit">
                  <Input
                    type="number"
                    value={form.depositAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, depositAmount: e.target.value }))
                    }
                  />
                </AdminDrawerFormField>
              </AdminDrawerFormRow>
            </AdminDrawerFormSection>

            <AdminDrawerFormSection title="Reward Configuration">
              <AdminDrawerFormRow>
                <AdminDrawerFormField label="Threshold (min)">
                  <Input
                    type="number"
                    value={form.rewardThresholdMinutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        rewardThresholdMinutes: e.target.value,
                      }))
                    }
                  />
                </AdminDrawerFormField>

                <AdminDrawerFormField label="Reward Value">
                  <Input
                    type="number"
                    value={form.rewardValue}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rewardValue: e.target.value }))
                    }
                  />
                </AdminDrawerFormField>
              </AdminDrawerFormRow>

              <AdminDrawerFormField label="Reward Description">
                <Input
                  value={form.rewardDescription}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      rewardDescription: e.target.value,
                    }))
                  }
                />
              </AdminDrawerFormField>
            </AdminDrawerFormSection>
          </AdminDrawerFormBody>

          <AdminDrawerFooter>
            <Button variant="outline" onClick={onOpenChange} disabled={loading}>
              Cancel
            </Button>

            <Button onClick={onSubmit} disabled={loading || !isValid}>
              {loading ? <Spinner className="mr-2 size-4" /> : null}
              Save Changes
            </Button>
          </AdminDrawerFooter>
        </>
      )}
    </AdminDrawer>
  );
}
