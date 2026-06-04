import { createServiceClient } from '@/lib/supabase/admin'
import type { DbCampaign } from './types'

export interface CampaignFilters {
  isActive?: boolean
  search?: string
  limit?: number
  offset?: number
}

class CampaignRepository {
  async getAll(filters?: CampaignFilters): Promise<DbCampaign[]> {
    const supabase = createServiceClient()
    let query = supabase.from('campaigns').select('*').order('start_date', { ascending: false })

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,event_name.ilike.%${filters.search}%`)
    }
    if (filters?.limit) query = query.limit(filters.limit)
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async getById(id: string): Promise<DbCampaign | null> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  }

  async create(input: {
    name: string
    eventName: string
    startDate: string
    endDate: string
    hourlyRate: number
    dailyCap: number
    depositAmount: number
    rewardThresholdMinutes: number
    rewardType: string
    rewardValue: number
    rewardDescription?: string
    isActive?: boolean
  }): Promise<DbCampaign> {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name: input.name,
        event_name: input.eventName,
        start_date: input.startDate,
        end_date: input.endDate,
        hourly_rate: input.hourlyRate,
        daily_cap: input.dailyCap,
        deposit_amount: input.depositAmount,
        reward_threshold_minutes: input.rewardThresholdMinutes,
        reward_type: input.rewardType,
        reward_value: input.rewardValue,
        reward_description: input.rewardDescription,
        is_active: input.isActive ?? true,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async update(
    id: string,
    updates: Partial<{
      name: string
      event_name: string
      start_date: string
      end_date: string
      hourly_rate: number
      daily_cap: number
      deposit_amount: number
      reward_threshold_minutes: number
      reward_type: string
      reward_value: number
      reward_description: string
      is_active: boolean
    }>,
  ): Promise<DbCampaign> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('campaigns').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
  }
}

export const campaignRepository = new CampaignRepository()
