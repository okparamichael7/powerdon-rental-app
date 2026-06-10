// Database module exports
// Repositories use the Supabase service role (bypasses RLS). All callers must enforce
// auth at the API/route layer via requireAdminSession, authorizeSessionAccess, etc.
export * from './types';
export { stationRepository, type StationWithSlots, type StationFilters, type CommandFilters } from './station-repository';
export { powerBankRepository } from './power-bank-repository';
export { resolveDbPowerBankId, isPowerBankUuid, normalizeTerminalExternalId } from './power-bank-resolve';
export { sessionRepository, userRepository, rewardRepository, type SessionWithRelations, type SessionFilters, type CreateSessionData } from './session-repository';
export { campaignRepository } from './campaign-repository';
export { analyticsRepository } from './analytics-repository';
export { supportRepository } from './support-repository';
export { staffRoleRepository, type DbStaffRole, type StaffRoleType, type GrantStaffRoleInput } from './staff-role-repository';
export { hardwareAuditRepository, type DbHardwareAuditLog, type HardwareAuditAction } from './hardware-audit-repository';
