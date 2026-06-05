// Admin dashboard services — always production APIs (no mock data in admin runtime).

import {
  ProductionStationService,
  ProductionRentalService,
  ProductionRewardService,
  ProductionCampaignService,
  ProductionSupportService,
  ProductionAnalyticsService,
  ProductionUserService,
} from './production-services'
import type { IStationService } from './station-service'
import type { IRentalService } from './rental-service'
import type { IRewardService } from './reward-service'
import type { ICampaignService } from './campaign-service'
import type { ISupportService } from './support-service'
import type { IAnalyticsService } from './analytics-service'
import type { IUserService } from './user-service'

export const stationService: IStationService = new ProductionStationService()
export const rentalService: IRentalService = new ProductionRentalService()
export const rewardService: IRewardService = new ProductionRewardService()
export const campaignService: ICampaignService = new ProductionCampaignService()
export const supportService: ISupportService = new ProductionSupportService()
export const analyticsService: IAnalyticsService = new ProductionAnalyticsService()
export const userService: IUserService = new ProductionUserService()

export type { IStationService, IRentalService, IRewardService, ICampaignService, ISupportService, IAnalyticsService, IUserService }
