'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { mockCampaigns } from '@/lib/mock-data';
import type { Campaign } from '@/lib/types';
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
} from 'lucide-react';

export default function CampaignsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage reward campaigns for your events
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus size={16} className="mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Campaign Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mockCampaigns.map((campaign) => (
          <Card key={campaign.id} className="relative overflow-hidden">
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
                <Button variant="ghost" size="icon" onClick={() => setSelectedCampaign(campaign)}>
                  <MoreVertical size={16} />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Date Range */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar size={14} />
                <span>
                  {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Euro size={14} />
                    <span className="text-xs font-medium">Pricing</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">€{campaign.hourlyRate}/hr</p>
                  <p className="text-xs text-muted-foreground">€{campaign.dailyCap} daily cap</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Euro size={14} />
                    <span className="text-xs font-medium">Deposit</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">€{campaign.depositAmount}</p>
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
                        <span>€{campaign.rewardValue} value</span>
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
                  <p className="text-2xl font-bold text-foreground">{campaign.totalSessions.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Gift size={14} />
                    <span className="text-xs">Rewards Issued</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{campaign.totalRewardsIssued.toLocaleString()}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedCampaign(campaign)}>
                  <Edit size={14} className="mr-2" />
                  Edit
                </Button>
                <Button variant="outline" className="flex-1">
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Set up a new reward campaign for your event
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Campaign Name</label>
              <Input placeholder="e.g., Summer Festival Rewards" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Event Name</label>
              <Input placeholder="e.g., Coachella 2025" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Start Date</label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">End Date</label>
                <Input type="date" />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hourly Rate (€)</label>
                <Input type="number" placeholder="2.00" step="0.50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Daily Cap (€)</label>
                <Input type="number" placeholder="10.00" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Deposit (€)</label>
                <Input type="number" placeholder="25.00" />
              </div>
            </div>
            
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="font-medium text-foreground mb-3">Reward Configuration</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Threshold (minutes)</label>
                  <Input type="number" placeholder="60" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Reward Value (€)</label>
                  <Input type="number" placeholder="10.00" />
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <label className="text-sm font-medium text-foreground">Reward Description</label>
                <Input placeholder="e.g., €10 voucher for official merchandise" />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCreateDialog(false)}>
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update campaign settings for {selectedCampaign?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCampaign && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Campaign Name</label>
                <Input defaultValue={selectedCampaign.name} />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Event Name</label>
                <Input defaultValue={selectedCampaign.eventName} />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Hourly Rate (€)</label>
                  <Input type="number" defaultValue={selectedCampaign.hourlyRate} step="0.50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Daily Cap (€)</label>
                  <Input type="number" defaultValue={selectedCampaign.dailyCap} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Deposit (€)</label>
                  <Input type="number" defaultValue={selectedCampaign.depositAmount} />
                </div>
              </div>
              
              <div className="border-t border-border pt-4 mt-4">
                <h4 className="font-medium text-foreground mb-3">Reward Configuration</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Threshold (minutes)</label>
                    <Input type="number" defaultValue={selectedCampaign.rewardThresholdMinutes} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Reward Value (€)</label>
                    <Input type="number" defaultValue={selectedCampaign.rewardValue} />
                  </div>
                </div>
                
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium text-foreground">Reward Description</label>
                  <Input defaultValue={selectedCampaign.rewardDescription} />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCampaign(null)}>
              Cancel
            </Button>
            <Button onClick={() => setSelectedCampaign(null)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
