// User/Lead service - handles all user/contact operations
// Production implementation using Supabase

import type { User } from '@/lib/types';
import type { 
  ApiResponse, 
  UserFilters,
  CreateUserRequest,
} from '@/lib/api/types';
import { 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
} from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

// User service interface
export interface IUserService {
  getUsers(filters?: UserFilters): Promise<ApiResponse<User[]>>;
  getUserById(id: string): Promise<ApiResponse<User>>;
  getUserByEmail(email: string): Promise<ApiResponse<User | null>>;
  createUser(request: CreateUserRequest): Promise<ApiResponse<User>>;
  updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>>;
  updateMarketingConsent(id: string, consent: boolean): Promise<ApiResponse<User>>;
  getUserStats(): Promise<ApiResponse<{
    totalUsers: number;
    marketingOptIns: number;
    activeRenters: number;
    repeatUsers: number;
  }>>;
}

// Transform database user to API user type
function transformUser(dbUser: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  marketing_consent: boolean;
  total_rentals: number;
  total_spend: number | null;
  created_at: string;
  updated_at: string;
  _lastRentalDate?: string | null;
}): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || undefined,
    phone: dbUser.phone || undefined,
    createdAt: new Date(dbUser.created_at),
    totalRentals: dbUser.total_rentals || 0,
    totalSpent: Number(dbUser.total_spend) || 0,
    marketingConsent: dbUser.marketing_consent || false,
    lastRentalDate: dbUser._lastRentalDate ? new Date(dbUser._lastRentalDate) : undefined,
  };
}

// Production implementation using Supabase
class SupabaseUserService implements IUserService {
  async getUsers(filters?: UserFilters): Promise<ApiResponse<User[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.marketingConsent !== undefined) {
        query = query.eq('marketing_consent', filters.marketingConsent);
      }

      if (filters?.search) {
        query = query.or(`email.ilike.%${filters.search}%,name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      if (filters?.dateRange?.from) {
        query = query.gte('created_at', filters.dateRange.from.toISOString());
      }

      if (filters?.dateRange?.to) {
        query = query.lte('created_at', filters.dateRange.to.toISOString());
      }

      // Apply pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[UserService] Error fetching users:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch users');
      }

      // Get last rental dates for each user
      const userIds = (data || []).map(u => u.id);
      const { data: rentals } = await supabase
        .from('rental_sessions')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      const lastRentalMap = new Map<string, string>();
      (rentals || []).forEach(r => {
        if (!lastRentalMap.has(r.user_id)) {
          lastRentalMap.set(r.user_id, r.created_at);
        }
      });

      const users = (data || []).map(u => transformUser({
        ...u,
        _lastRentalDate: lastRentalMap.get(u.id),
      }));

      // Filter by active rental if needed
      let filteredUsers = users;
      if (filters?.hasActiveRental !== undefined) {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filteredUsers = users.filter(u => 
          filters.hasActiveRental 
            ? (u.lastRentalDate && u.lastRentalDate >= oneDayAgo)
            : (!u.lastRentalDate || u.lastRentalDate < oneDayAgo)
        );
      }

      return createSuccessResponse(filteredUsers, {
        page,
        limit,
        total: count || filteredUsers.length,
      });
    } catch (err) {
      console.error('[UserService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[UserService] Error fetching user:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch user');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.NOT_FOUND, `User ${id} not found`);
      }

      // Get last rental date
      const { data: rental } = await supabase
        .from('rental_sessions')
        .select('created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return createSuccessResponse(transformUser({
        ...data,
        _lastRentalDate: rental?.created_at,
      }));
    } catch (err) {
      console.error('[UserService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getUserByEmail(email: string): Promise<ApiResponse<User | null>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('[UserService] Error fetching user by email:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch user');
      }

      if (!data) {
        return createSuccessResponse(null);
      }

      // Get last rental date
      const { data: rental } = await supabase
        .from('rental_sessions')
        .select('created_at')
        .eq('user_id', data.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return createSuccessResponse(transformUser({
        ...data,
        _lastRentalDate: rental?.created_at,
      }));
    } catch (err) {
      console.error('[UserService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async createUser(request: CreateUserRequest): Promise<ApiResponse<User>> {
    try {
      const supabase = createClient();
      
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', request.email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        return createSuccessResponse(transformUser(existingUser));
      }

      const { data, error } = await supabase
        .from('users')
        .insert({
          email: request.email.toLowerCase(),
          name: request.name,
          phone: request.phone,
          marketing_consent: request.marketingConsent || false,
          total_rentals: 0,
          total_spend: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('[UserService] Error creating user:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to create user');
      }

      return createSuccessResponse(transformUser(data));
    } catch (err) {
      console.error('[UserService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const supabase = createClient();
      
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.marketingConsent !== undefined) dbUpdates.marketing_consent = updates.marketingConsent;
      if (updates.totalRentals !== undefined) dbUpdates.total_rentals = updates.totalRentals;
      if (updates.totalSpent !== undefined) dbUpdates.total_spend = updates.totalSpent;
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('users')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[UserService] Error updating user:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to update user');
      }

      return createSuccessResponse(transformUser(data));
    } catch (err) {
      console.error('[UserService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async updateMarketingConsent(id: string, consent: boolean): Promise<ApiResponse<User>> {
    return this.updateUser(id, { marketingConsent: consent });
  }

  async getUserStats(): Promise<ApiResponse<{
    totalUsers: number;
    marketingOptIns: number;
    activeRenters: number;
    repeatUsers: number;
  }>> {
    try {
      const supabase = createClient();
      
      const [
        totalUsersResult,
        marketingOptInsResult,
        repeatUsersResult,
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('marketing_consent', true),
        supabase.from('users').select('id', { count: 'exact', head: true }).gt('total_rentals', 1),
      ]);

      // Get active renters (users with sessions in last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: activeRentals } = await supabase
        .from('rental_sessions')
        .select('user_id')
        .in('status', ['pending', 'active'])
        .gte('created_at', oneDayAgo);

      const uniqueActiveRenters = new Set((activeRentals || []).map(r => r.user_id)).size;

      return createSuccessResponse({
        totalUsers: totalUsersResult.count || 0,
        marketingOptIns: marketingOptInsResult.count || 0,
        activeRenters: uniqueActiveRenters,
        repeatUsers: repeatUsersResult.count || 0,
      });
    } catch (err) {
      console.error('[UserService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }
}

// Export singleton instance - now using real Supabase implementation
export const userService: IUserService = new SupabaseUserService();
