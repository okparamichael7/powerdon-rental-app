// Services barrel export — production implementations unless mock mode is enabled

import { isMockDataEnabled } from './config'
import { stationService as mockStationService, type IStationService } from './station-service'
import { rentalService as mockRentalService, type IRentalService } from './rental-service'
import { rewardService as mockRewardService, type IRewardService } from './reward-service'
import { campaignService as mockCampaignService, type ICampaignService } from './campaign-service'
import { supportService as mockSupportService, supportFaqs, type ISupportService } from './support-service'
import { analyticsService as mockAnalyticsService, type IAnalyticsService } from './analytics-service'
import { userService as mockUserService, type IUserService } from './user-service'
import { hardwareService, type IHardwareService } from './hardware-service'
import {
  ProductionStationService,
  ProductionRentalService,
  ProductionRewardService,
  ProductionCampaignService,
  ProductionSupportService,
  ProductionAnalyticsService,
  ProductionUserService,
} from './production-services'

const useMock = isMockDataEnabled()

export const stationService: IStationService = useMock ? mockStationService : new ProductionStationService()
export const rentalService: IRentalService = useMock ? mockRentalService : new ProductionRentalService()
export const rewardService: IRewardService = useMock ? mockRewardService : new ProductionRewardService()
export const campaignService: ICampaignService = useMock ? mockCampaignService : new ProductionCampaignService()
export const supportService: ISupportService = useMock ? mockSupportService : new ProductionSupportService()
export const analyticsService: IAnalyticsService = useMock ? mockAnalyticsService : new ProductionAnalyticsService()
export const userService: IUserService = useMock ? mockUserService : new ProductionUserService()

export { supportFaqs, hardwareService, type IStationService, type IRentalService, type IRewardService }
export { type ICampaignService, type ISupportService, type IAnalyticsService, type IUserService, type IHardwareService }
