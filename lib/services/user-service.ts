// User/Lead service - handles all user/contact operations
// Mock implementation with interface ready for real backend

import type { User } from '@/lib/types';
import type { 
  ApiResponse, 
  UserFilters,
  CreateUserRequest,
} from '@/lib/api/types';
import { 
  simulateNetworkDelay, 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateId,
} from '@/lib/api/client';
import { mockUsers } from '@/lib/mock-data';

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

// In-memory user store
let users: User[] = [...mockUsers];

// Mock implementation
class MockUserService implements IUserService {
  async getUsers(filters?: UserFilters): Promise<ApiResponse<User[]>> {
    await simulateNetworkDelay();

    let result = [...users];

    // Apply filters
    if (filters?.marketingConsent !== undefined) {
      result = result.filter(u => u.marketingConsent === filters.marketingConsent);
    }

    if (filters?.hasActiveRental !== undefined) {
      // In real impl, would check against active sessions
      result = result.filter(u => u.lastRentalDate && 
        (new Date().getTime() - u.lastRentalDate.getTime()) < 24 * 60 * 60 * 1000
      );
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(u => 
        u.email.toLowerCase().includes(search) || 
        u.name?.toLowerCase().includes(search) ||
        u.phone?.includes(search)
      );
    }

    if (filters?.dateRange) {
      if (filters.dateRange.from) {
        result = result.filter(u => u.createdAt >= filters.dateRange!.from!);
      }
      if (filters.dateRange.to) {
        result = result.filter(u => u.createdAt <= filters.dateRange!.to!);
      }
    }

    // Sort by created date (newest first)
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const paginated = result.slice(start, start + limit);

    return createSuccessResponse(paginated, {
      page,
      limit,
      total: result.length,
    });
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    await simulateNetworkDelay();

    const user = users.find(u => u.id === id);
    
    if (!user) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `User ${id} not found`
      );
    }

    return createSuccessResponse(user);
  }

  async getUserByEmail(email: string): Promise<ApiResponse<User | null>> {
    await simulateNetworkDelay();

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    return createSuccessResponse(user || null);
  }

  async createUser(request: CreateUserRequest): Promise<ApiResponse<User>> {
    await simulateNetworkDelay();

    // Check if user already exists
    const existingUser = users.find(u => u.email.toLowerCase() === request.email.toLowerCase());
    if (existingUser) {
      return createSuccessResponse(existingUser);
    }

    const newUser: User = {
      id: generateId('USR'),
      email: request.email,
      name: request.name,
      phone: request.phone,
      createdAt: new Date(),
      totalRentals: 0,
      totalSpent: 0,
      marketingConsent: request.marketingConsent,
    };

    users.unshift(newUser);

    return createSuccessResponse(newUser);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    await simulateNetworkDelay();

    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `User ${id} not found`
      );
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
    };

    return createSuccessResponse(users[userIndex]);
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
    await simulateNetworkDelay();

    const now = new Date();
    const stats = {
      totalUsers: users.length,
      marketingOptIns: users.filter(u => u.marketingConsent).length,
      activeRenters: users.filter(u => 
        u.lastRentalDate && (now.getTime() - u.lastRentalDate.getTime()) < 24 * 60 * 60 * 1000
      ).length,
      repeatUsers: users.filter(u => u.totalRentals > 1).length,
    };

    return createSuccessResponse(stats);
  }
}

// Export singleton instance
export const userService: IUserService = new MockUserService();
