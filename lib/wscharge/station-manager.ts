// WsCharge Station Connection Manager
// Manages connected charging stations and their state

import * as protocol from './protocol';
import { dispatchCommandToTcpProxy } from './command-dispatch';
import { getWsChargeConfig } from './config';
import { stationRepository } from '@/lib/db';

// Station connection state
export interface StationConnection {
  stationId: string;
  productSn: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  lastInventoryUpdate: Date | null;
  isOnline: boolean;
  signalStrength: number;
  iccid: string | null;
  firmwareVersion: string | null;
  inventory: protocol.SlotInventory[];
  pendingCommands: PendingCommand[];
}

// Pending command waiting for response
export interface PendingCommand {
  id: string;
  command: protocol.CommandCode;
  sentAt: Date;
  payload?: Buffer;
  resolve: (response: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

// Connection events
export type ConnectionEventType = 
  | 'station_connected'
  | 'station_disconnected'
  | 'station_heartbeat'
  | 'inventory_updated'
  | 'powerbank_returned'
  | 'powerbank_borrowed'
  | 'command_timeout';

export interface ConnectionEvent {
  type: ConnectionEventType;
  stationId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// Event listener type
export type ConnectionEventListener = (event: ConnectionEvent) => void;

// Station connection manager
class StationConnectionManager {
  private connections: Map<string, StationConnection> = new Map();
  /** Maps database station UUID → cabinet product SN (WsCharge connection key). */
  private dbIdToProductSn = new Map<string, string>();
  private eventListeners: ConnectionEventListener[] = [];
  private commandTimeout = parseInt(process.env.WSCHARGE_COMMAND_TIMEOUT_MS || '30000', 10);
  private heartbeatTimeout = parseInt(process.env.WSCHARGE_HEARTBEAT_STALE_MS || '120000', 10);

  /** Link DB UUID to live TCP session key (product SN). */
  linkDbId(dbId: string, productSn: string): void {
    this.dbIdToProductSn.set(dbId, productSn);
  }

  resolveConnectionKey(stationIdOrDbId: string): string {
    return this.dbIdToProductSn.get(stationIdOrDbId) ?? stationIdOrDbId;
  }

  /** Resolve DB UUID or product SN to cabinet ProductSn for TCP proxy commands. */
  async resolveProductSn(stationIdOrDbId: string): Promise<string> {
    const mapped = this.dbIdToProductSn.get(stationIdOrDbId);
    if (mapped) return mapped;

    const live = this.connections.get(stationIdOrDbId);
    if (live) return live.productSn;

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stationIdOrDbId)) {
      const row = await stationRepository.getById(stationIdOrDbId);
      if (row?.external_id) {
        this.linkDbId(stationIdOrDbId, row.external_id);
        return row.external_id;
      }
    }

    return stationIdOrDbId;
  }

  // Register event listener
  addEventListener(listener: ConnectionEventListener): void {
    this.eventListeners.push(listener);
  }

  // Remove event listener
  removeEventListener(listener: ConnectionEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  // Emit event to all listeners
  private emitEvent(event: ConnectionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[StationManager] Error in event listener:', error);
      }
    });
  }

  // Handle station login
  handleLogin(loginMsg: protocol.LoginMessage): { connection: StationConnection; response: Buffer } {
    const now = new Date();
    const stationId = loginMsg.productSn;

    // Check if already connected
    let connection = this.connections.get(stationId);
    
    if (connection) {
      // Reconnection - update timestamps
      connection.connectedAt = now;
      connection.lastHeartbeat = now;
      connection.isOnline = true;
    } else {
      // New connection
      connection = {
        stationId,
        productSn: loginMsg.productSn,
        connectedAt: now,
        lastHeartbeat: now,
        lastInventoryUpdate: null,
        isOnline: true,
        signalStrength: 0,
        iccid: null,
        firmwareVersion: null,
        inventory: [],
        pendingCommands: [],
      };
      this.connections.set(stationId, connection);
    }

    this.emitEvent({
      type: 'station_connected',
      stationId,
      timestamp: now,
      data: { productSn: loginMsg.productSn },
    });

    // Send success response
    const response = protocol.buildLoginResponse(protocol.LoginResult.SUCCESS);
    return { connection, response };
  }

  // Handle heartbeat
  handleHeartbeat(stationId: string): Buffer {
    const connection = this.connections.get(stationId);
    if (connection) {
      connection.lastHeartbeat = new Date();
      connection.isOnline = true;

      this.emitEvent({
        type: 'station_heartbeat',
        stationId,
        timestamp: connection.lastHeartbeat,
      });
    }

    return protocol.buildHeartbeatResponse();
  }

  // Handle inventory response
  handleInventoryResponse(stationId: string, inventory: protocol.InventoryResponse): void {
    const connection = this.connections.get(stationId);
    if (connection) {
      connection.inventory = inventory.slots;
      connection.lastInventoryUpdate = new Date();

      this.emitEvent({
        type: 'inventory_updated',
        stationId,
        timestamp: new Date(),
        data: { 
          slotCount: inventory.remainingCount,
          slots: inventory.slots,
        },
      });

      // Resolve any pending inventory commands
      this.resolvePendingCommand(stationId, protocol.CommandCode.QUERY_INVENTORY, inventory);
    }
  }

  // Handle power bank return (cabinet initiated)
  handleReturn(stationId: string, returnMsg: protocol.ReturnMessage): Buffer {
    const connection = this.connections.get(stationId);
    
    this.emitEvent({
      type: 'powerbank_returned',
      stationId,
      timestamp: new Date(),
      data: {
        slotNumber: returnMsg.slotNumber,
        terminalId: returnMsg.terminalId,
      },
    });

    // Update local inventory
    if (connection) {
      const existingSlot = connection.inventory.find(s => s.slotNumber === returnMsg.slotNumber);
      if (!existingSlot) {
        connection.inventory.push({
          slotNumber: returnMsg.slotNumber,
          terminalId: returnMsg.terminalId,
          batteryLevel: protocol.BatteryLevel.LEVEL_20, // Will be updated on next inventory query
        });
      }
    }

    // Send success response
    return protocol.buildReturnResponse(returnMsg.slotNumber, protocol.ReturnResult.SUCCESS);
  }

  // Handle borrow response
  handleBorrowResponse(stationId: string, borrowResponse: protocol.BorrowResponse): void {
    const connection = this.connections.get(stationId);
    
    if (borrowResponse.result === protocol.BorrowResult.SUCCESS) {
      this.emitEvent({
        type: 'powerbank_borrowed',
        stationId,
        timestamp: new Date(),
        data: {
          slotNumber: borrowResponse.slotNumber,
          terminalId: borrowResponse.terminalId,
          success: true,
        },
      });

      // Update local inventory - remove the slot
      if (connection) {
        connection.inventory = connection.inventory.filter(
          s => s.slotNumber !== borrowResponse.slotNumber
        );
      }
    }

    // Resolve pending command
    this.resolvePendingCommand(stationId, protocol.CommandCode.BORROW_POWERBANK, borrowResponse);
  }

  // Handle force eject response
  handleForceEjectResponse(stationId: string, ejectResponse: protocol.ForceEjectResponse): void {
    if (ejectResponse.result === protocol.BorrowResult.SUCCESS) {
      const connection = this.connections.get(stationId);
      if (connection) {
        connection.inventory = connection.inventory.filter(
          s => s.slotNumber !== ejectResponse.slotNumber
        );
      }
    }

    this.resolvePendingCommand(stationId, protocol.CommandCode.FORCE_EJECT, ejectResponse);
  }

  // Send command to station
  async sendCommand<T>(
    stationId: string, 
    command: protocol.CommandCode, 
    payload?: Buffer
  ): Promise<{ success: boolean; data?: T; error?: string; commandBuffer: Buffer; dispatched?: boolean; proxyOnly?: boolean }> {
    const productSn = await this.resolveProductSn(stationId);
    const connection = this.connections.get(productSn);

    // Build command buffer
    let commandBuffer: Buffer;
    switch (command) {
      case protocol.CommandCode.QUERY_INVENTORY:
        commandBuffer = protocol.buildInventoryQuery();
        break;
      case protocol.CommandCode.BORROW_POWERBANK:
        if (payload) {
          commandBuffer = protocol.buildBorrowCommand(payload.readUInt8(0));
        } else {
          return { success: false, error: 'Slot number required', commandBuffer: Buffer.alloc(0) };
        }
        break;
      case protocol.CommandCode.FORCE_EJECT:
        if (payload) {
          commandBuffer = protocol.buildForceEjectCommand(payload.readUInt8(0));
        } else {
          commandBuffer = protocol.buildFullEjectCommand();
        }
        break;
      case protocol.CommandCode.QUERY_NETWORK_INFO:
        commandBuffer = protocol.buildNetworkInfoQuery();
        break;
      case protocol.CommandCode.QUERY_ICCID:
        commandBuffer = protocol.buildIccidQuery();
        break;
      case protocol.CommandCode.QUERY_VERSION:
        commandBuffer = protocol.buildVersionQuery();
        break;
      case protocol.CommandCode.QUERY_SERVER_ADDRESS:
        commandBuffer = protocol.buildServerAddressQuery();
        break;
      case protocol.CommandCode.REMOTE_REBOOT:
        commandBuffer = protocol.buildRemoteRebootCommand();
        break;
      default:
        return { success: false, error: 'Unknown command', commandBuffer: Buffer.alloc(0) };
    }

    // Production: cabinet TCP lives on Hetzner proxy, not in-memory on Vercel.
    const { proxyUrl } = getWsChargeConfig();
    if ((!connection || !connection.isOnline) && proxyUrl) {
      const dispatch = await dispatchCommandToTcpProxy(productSn, commandBuffer);
      if (!dispatch.dispatched) {
        return {
          success: false,
          error: dispatch.error || 'Station not connected',
          commandBuffer,
        };
      }
      return { success: true, commandBuffer, dispatched: true, proxyOnly: true };
    }

    if (!connection || !connection.isOnline) {
      return {
        success: false,
        error: 'Station not connected',
        commandBuffer: Buffer.alloc(0),
      };
    }

    // Local dev: wait for in-process response via pending command queue
    return new Promise((resolve) => {
      const commandId = `${productSn}-${command}-${Date.now()}`;
      
      const timeoutId = setTimeout(() => {
        this.handleCommandTimeout(productSn, commandId);
        resolve({ success: false, error: 'Command timeout', commandBuffer });
      }, this.commandTimeout);

      const pendingCommand: PendingCommand = {
        id: commandId,
        command,
        sentAt: new Date(),
        payload,
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve({ success: true, data: response as T, commandBuffer, dispatched: true });
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          resolve({ success: false, error: error.message, commandBuffer });
        },
        timeoutId,
      };

      connection.pendingCommands.push(pendingCommand);

      void dispatchCommandToTcpProxy(productSn, commandBuffer).then((dispatch) => {
        if (!dispatch.dispatched) {
          pendingCommand.reject(new Error(dispatch.error || 'Failed to send command to station'));
        }
      });
    });
  }

  // Resolve pending command
  private resolvePendingCommand(stationId: string, command: protocol.CommandCode, response: unknown): void {
    const connection = this.connections.get(stationId);
    if (!connection) return;

    const pendingIndex = connection.pendingCommands.findIndex(c => c.command === command);
    if (pendingIndex !== -1) {
      const pending = connection.pendingCommands[pendingIndex];
      connection.pendingCommands.splice(pendingIndex, 1);
      pending.resolve(response);
    }
  }

  // Handle command timeout
  private handleCommandTimeout(stationId: string, commandId: string): void {
    const connection = this.connections.get(stationId);
    if (!connection) return;

    const pendingIndex = connection.pendingCommands.findIndex(c => c.id === commandId);
    if (pendingIndex !== -1) {
      const pending = connection.pendingCommands[pendingIndex];
      connection.pendingCommands.splice(pendingIndex, 1);
      
      this.emitEvent({
        type: 'command_timeout',
        stationId,
        timestamp: new Date(),
        data: { command: pending.command },
      });
    }
  }

  // Handle station disconnect
  handleDisconnect(stationId: string): void {
    const connection = this.connections.get(stationId);
    if (connection) {
      connection.isOnline = false;
      
      // Reject all pending commands
      connection.pendingCommands.forEach(pending => {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Station disconnected'));
      });
      connection.pendingCommands = [];

      this.emitEvent({
        type: 'station_disconnected',
        stationId,
        timestamp: new Date(),
      });
    }
  }

  // Check for stale connections (missed heartbeats)
  checkStaleConnections(): void {
    const now = Date.now();
    
    this.connections.forEach((connection, stationId) => {
      if (connection.isOnline && 
          now - connection.lastHeartbeat.getTime() > this.heartbeatTimeout) {
        connection.isOnline = false;
        
        this.emitEvent({
          type: 'station_disconnected',
          stationId,
          timestamp: new Date(),
          data: { reason: 'heartbeat_timeout' },
        });
      }
    });
  }

  // Get all connected stations
  getConnectedStations(): StationConnection[] {
    return Array.from(this.connections.values()).filter(c => c.isOnline);
  }

  // Get station by ID
  getStation(stationId: string): StationConnection | undefined {
    return this.connections.get(this.resolveConnectionKey(stationId));
  }

  // Get station inventory
  getStationInventory(stationId: string): protocol.SlotInventory[] {
    const connection = this.connections.get(this.resolveConnectionKey(stationId));
    return connection?.inventory || [];
  }

  // Get available slot with highest battery
  getBestAvailableSlot(stationId: string): protocol.SlotInventory | null {
    const inventory = this.getStationInventory(stationId);
    if (inventory.length === 0) return null;

    return inventory.reduce((best, slot) => 
      slot.batteryLevel > best.batteryLevel ? slot : best
    );
  }

  // Check if station has available power banks
  hasAvailablePowerBanks(stationId: string): boolean {
    const connection = this.connections.get(this.resolveConnectionKey(stationId));
    return connection ? connection.inventory.length > 0 : false;
  }

  // Get station stats
  getStationStats(stationId: string): {
    totalSlots: number;
    availableSlots: number;
    isOnline: boolean;
    lastHeartbeat: Date | null;
  } | null {
    const connection = this.connections.get(this.resolveConnectionKey(stationId));
    if (!connection) return null;

    return {
      totalSlots: 8, // Default for most cabinets - would come from station config
      availableSlots: connection.inventory.length,
      isOnline: connection.isOnline,
      lastHeartbeat: connection.lastHeartbeat,
    };
  }
}

// Export singleton instance
export const stationManager = new StationConnectionManager();

// Start heartbeat checker interval
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    stationManager.checkStaleConnections();
  }, 30000); // Check every 30 seconds
}
