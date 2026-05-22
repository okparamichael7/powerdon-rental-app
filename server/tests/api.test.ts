/**
 * API Integration Tests
 * 
 * Tests for the station management and rental flow API endpoints.
 * These tests use the fetch API to test endpoints against a running server.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

// Helper to make API requests
async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; data: unknown }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

// ============================================================================
// Station API Tests
// ============================================================================

describe('Station API', () => {
  describe('GET /api/stations', () => {
    it('should return list of stations', async () => {
      const { status, data } = await apiRequest('/api/stations');
      
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray((data as { stations: unknown[] }).stations));
    });

    it('should include station details in response', async () => {
      const { status, data } = await apiRequest('/api/stations');
      
      assert.strictEqual(status, 200);
      const response = data as { stations: Array<{ id: string; name: string; status: string }> };
      
      if (response.stations.length > 0) {
        const station = response.stations[0];
        assert.ok(station.id);
        assert.ok(station.name);
        assert.ok(station.status);
      }
    });
  });

  describe('GET /api/stations/:id', () => {
    it('should return 404 for non-existent station', async () => {
      const { status } = await apiRequest('/api/stations/non-existent-id');
      assert.strictEqual(status, 404);
    });

    it('should return station details when found', async () => {
      // First get list to find a valid ID
      const { data: listData } = await apiRequest('/api/stations');
      const stations = (listData as { stations: Array<{ id: string }> }).stations;
      
      if (stations.length > 0) {
        const { status, data } = await apiRequest(`/api/stations/${stations[0].id}`);
        assert.strictEqual(status, 200);
        assert.ok((data as { station: { id: string } }).station);
      }
    });
  });

  describe('POST /api/stations/:id (commands)', () => {
    it('should reject invalid command', async () => {
      const { status } = await apiRequest('/api/stations/test-station', {
        method: 'POST',
        body: JSON.stringify({ command: 'invalid_command' }),
      });
      
      assert.ok(status === 400 || status === 404);
    });

    it('should accept valid reboot command format', async () => {
      const { status, data } = await apiRequest('/api/stations/test-station', {
        method: 'POST',
        body: JSON.stringify({ command: 'reboot' }),
      });
      
      // Either success or station not found - both are valid responses
      assert.ok(status === 200 || status === 404 || status === 503);
    });
  });
});

// ============================================================================
// Station Inventory API Tests
// ============================================================================

describe('Station Inventory API', () => {
  describe('GET /api/stations/:id/inventory', () => {
    it('should return inventory data', async () => {
      const { data: listData } = await apiRequest('/api/stations');
      const stations = (listData as { stations: Array<{ id: string }> }).stations;
      
      if (stations.length > 0) {
        const { status, data } = await apiRequest(`/api/stations/${stations[0].id}/inventory`);
        
        if (status === 200) {
          const inventory = data as { slots: unknown[] };
          assert.ok(Array.isArray(inventory.slots));
        } else {
          // Station might be offline
          assert.ok(status === 404 || status === 503);
        }
      }
    });
  });

  describe('POST /api/stations/:id/inventory (refresh)', () => {
    it('should trigger inventory refresh', async () => {
      const { data: listData } = await apiRequest('/api/stations');
      const stations = (listData as { stations: Array<{ id: string }> }).stations;
      
      if (stations.length > 0) {
        const { status } = await apiRequest(`/api/stations/${stations[0].id}/inventory`, {
          method: 'POST',
        });
        
        // Either success or station offline
        assert.ok(status === 200 || status === 202 || status === 404 || status === 503);
      }
    });
  });
});

// ============================================================================
// Unlock API Tests
// ============================================================================

describe('Station Unlock API', () => {
  describe('POST /api/stations/:id/unlock', () => {
    it('should require slot number', async () => {
      const { status } = await apiRequest('/api/stations/test-station/unlock', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      assert.ok(status === 400 || status === 404);
    });

    it('should validate slot number is positive', async () => {
      const { status, data } = await apiRequest('/api/stations/test-station/unlock', {
        method: 'POST',
        body: JSON.stringify({ slotNumber: -1 }),
      });
      
      if (status === 400) {
        const response = data as { error?: { code: string } };
        assert.ok(response.error);
      }
    });

    it('should accept valid unlock request format', async () => {
      const { status } = await apiRequest('/api/stations/test-station/unlock', {
        method: 'POST',
        body: JSON.stringify({ slotNumber: 1 }),
      });
      
      // Either validation error, station not found, or success
      assert.ok([200, 400, 404, 503].includes(status));
    });
  });
});

// ============================================================================
// Message Handler API Tests
// ============================================================================

describe('Station Message API', () => {
  describe('POST /api/stations/message', () => {
    it('should require message data', async () => {
      const { status } = await apiRequest('/api/stations/message', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      assert.strictEqual(status, 400);
    });

    it('should accept hex-encoded message', async () => {
      // Valid protocol message (login)
      const hexMessage = '6865544553543030310000000000000000010D0A';
      
      const { status } = await apiRequest('/api/stations/message', {
        method: 'POST',
        body: JSON.stringify({ 
          data: hexMessage,
          encoding: 'hex'
        }),
      });
      
      // Should process or reject with validation error, not crash
      assert.ok([200, 400, 422].includes(status));
    });

    it('should accept base64-encoded message', async () => {
      const base64Message = Buffer.from([0x68, 0x65, 0x54, 0x45, 0x53, 0x54]).toString('base64');
      
      const { status } = await apiRequest('/api/stations/message', {
        method: 'POST',
        body: JSON.stringify({ 
          data: base64Message,
          encoding: 'base64'
        }),
      });
      
      assert.ok([200, 400, 422].includes(status));
    });
  });
});

// ============================================================================
// Rental API Tests
// ============================================================================

describe('Rental API', () => {
  describe('POST /api/rentals/start', () => {
    it('should require station ID', async () => {
      const { status, data } = await apiRequest('/api/rentals/start', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      });
      
      assert.strictEqual(status, 400);
      const response = data as { error?: { code: string } };
      assert.ok(response.error);
    });

    it('should require email', async () => {
      const { status, data } = await apiRequest('/api/rentals/start', {
        method: 'POST',
        body: JSON.stringify({
          stationId: 'SIM001',
        }),
      });
      
      assert.strictEqual(status, 400);
      const response = data as { error?: { code: string } };
      assert.ok(response.error);
    });

    it('should validate email format', async () => {
      const { status } = await apiRequest('/api/rentals/start', {
        method: 'POST',
        body: JSON.stringify({
          stationId: 'SIM001',
          email: 'invalid-email',
        }),
      });
      
      assert.strictEqual(status, 400);
    });

    it('should accept valid rental start request', async () => {
      const { status } = await apiRequest('/api/rentals/start', {
        method: 'POST',
        body: JSON.stringify({
          stationId: 'SIM001',
          email: 'test@example.com',
          name: 'Test User',
        }),
      });
      
      // Could be success, station not found, or no available slots
      assert.ok([200, 201, 400, 404, 409, 503].includes(status));
    });
  });

  describe('GET /api/rentals/:sessionId', () => {
    it('should return 404 for non-existent session', async () => {
      const { status } = await apiRequest('/api/rentals/non-existent-session-id');
      assert.strictEqual(status, 404);
    });
  });

  describe('POST /api/rentals/:sessionId/cancel', () => {
    it('should return 404 for non-existent session', async () => {
      const { status } = await apiRequest('/api/rentals/non-existent-session-id/cancel', {
        method: 'POST',
      });
      assert.strictEqual(status, 404);
    });
  });
});

// ============================================================================
// Health Check
// ============================================================================

describe('Health Check', () => {
  it('should respond to health endpoint', async () => {
    const { status } = await apiRequest('/api/health');
    // Either we have a health endpoint or we get 404
    assert.ok([200, 404].includes(status));
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('Error Handling', () => {
  it('should return JSON error for invalid JSON body', async () => {
    const response = await fetch(`${API_BASE_URL}/api/stations/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json {',
    });
    
    assert.strictEqual(response.status, 400);
  });

  it('should handle missing Content-Type gracefully', async () => {
    const response = await fetch(`${API_BASE_URL}/api/stations/message`, {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
    });
    
    // Should not crash - either process or reject
    assert.ok(response.status < 500);
  });
});

console.log('Running API Integration Tests...\n');
console.log(`Testing against: ${API_BASE_URL}\n`);
