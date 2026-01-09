/**
 * Atlas Mock Matrix Service
 * 
 * A serverless Matrix-compatible service that runs entirely in-memory.
 * Simulates the Matrix protocol for expert communication without requiring
 * a real homeserver. Events are stored as if they occurred on a real
 * Matrix server, creating auditable logs.
 * 
 * Features:
 * - In-memory event storage with Matrix-compatible structure
 * - Room management (create, join, leave)
 * - Timeline events with proper ordering
 * - State events for room metadata
 * - Sync simulation for real-time updates
 * - Export/import for persistence
 */

// ============ Matrix Protocol Types ============

export interface MatrixUserId {
  localpart: string;
  domain: string;
  full: string;  // @localpart:domain
}

export interface MatrixRoomId {
  localpart: string;
  domain: string;
  full: string;  // !localpart:domain
}

export interface MatrixEventId {
  localpart: string;
  domain: string;
  full: string;  // $localpart:domain
}

export interface MatrixEvent {
  event_id: string;
  type: string;
  room_id: string;
  sender: string;
  origin_server_ts: number;
  content: Record<string, unknown>;
  unsigned?: {
    age?: number;
    transaction_id?: string;
    prev_content?: Record<string, unknown>;
  };
  state_key?: string;  // Present for state events
}

export interface MatrixRoomState {
  name?: string;
  topic?: string;
  avatar_url?: string;
  join_rules?: 'public' | 'invite' | 'knock' | 'private';
  history_visibility?: 'invited' | 'joined' | 'shared' | 'world_readable';
  members: Map<string, MatrixMember>;
  power_levels?: MatrixPowerLevels;
}

export interface MatrixMember {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  membership: 'invite' | 'join' | 'leave' | 'ban' | 'knock';
  since: number;
}

export interface MatrixPowerLevels {
  ban?: number;
  events?: Record<string, number>;
  events_default?: number;
  invite?: number;
  kick?: number;
  redact?: number;
  state_default?: number;
  users?: Record<string, number>;
  users_default?: number;
}

export interface MatrixRoom {
  room_id: string;
  state: MatrixRoomState;
  timeline: MatrixEvent[];
  stateEvents: Map<string, MatrixEvent>;  // key: type + state_key
  createdAt: number;
  version: string;
}

export interface MatrixSyncResponse {
  next_batch: string;
  rooms: {
    join: Record<string, {
      timeline: {
        events: MatrixEvent[];
        limited: boolean;
        prev_batch?: string;
      };
      state: {
        events: MatrixEvent[];
      };
      ephemeral?: {
        events: MatrixEvent[];
      };
    }>;
    invite: Record<string, unknown>;
    leave: Record<string, unknown>;
  };
}

// ============ Mock Matrix Server ============

export interface MockMatrixConfig {
  serverName: string;
  defaultPowerLevel: number;
  maxTimelineEvents: number;
}

export type MatrixEventHandler = (event: MatrixEvent, room: MatrixRoom) => void;

class MockMatrixServer {
  private config: MockMatrixConfig;
  private rooms = new Map<string, MatrixRoom>();
  private users = new Map<string, MatrixUserId>();
  private eventCounter = 0;
  private syncToken = 0;
  private eventHandlers = new Set<MatrixEventHandler>();
  
  // Event buffer for sync simulation
  private pendingEvents = new Map<string, MatrixEvent[]>();  // roomId -> events since last sync
  
  constructor(config: Partial<MockMatrixConfig> = {}) {
    this.config = {
      serverName: config.serverName || 'atlas.local',
      defaultPowerLevel: config.defaultPowerLevel || 0,
      maxTimelineEvents: config.maxTimelineEvents || 1000,
    };
    
    console.log(`[MockMatrix] Server initialized: ${this.config.serverName}`);
  }
  
  // ============ ID Generation ============
  
  private generateEventId(): string {
    this.eventCounter++;
    const random = Math.random().toString(36).substring(2, 10);
    return `$${Date.now()}_${this.eventCounter}_${random}:${this.config.serverName}`;
  }
  
  private generateRoomId(): string {
    const random = Math.random().toString(36).substring(2, 18);
    return `!${random}:${this.config.serverName}`;
  }
  
  createUserId(localpart: string): MatrixUserId {
    const full = `@${localpart}:${this.config.serverName}`;
    const userId: MatrixUserId = {
      localpart,
      domain: this.config.serverName,
      full,
    };
    this.users.set(full, userId);
    return userId;
  }
  
  // ============ Room Management ============
  
  createRoom(options: {
    name?: string;
    topic?: string;
    creator: string;
    invite?: string[];
    preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat';
  }): MatrixRoom {
    const roomId = this.generateRoomId();
    const now = Date.now();
    
    const room: MatrixRoom = {
      room_id: roomId,
      state: {
        name: options.name,
        topic: options.topic,
        join_rules: options.preset === 'public_chat' ? 'public' : 'invite',
        history_visibility: 'shared',
        members: new Map(),
        power_levels: {
          ban: 50,
          events_default: 0,
          invite: 50,
          kick: 50,
          redact: 50,
          state_default: 50,
          users: { [options.creator]: 100 },
          users_default: 0,
        },
      },
      timeline: [],
      stateEvents: new Map(),
      createdAt: now,
      version: '10',
    };
    
    this.rooms.set(roomId, room);
    this.pendingEvents.set(roomId, []);
    
    // Create room state events
    this.sendStateEvent(roomId, 'm.room.create', '', {
      creator: options.creator,
      room_version: '10',
    }, options.creator);
    
    // Join the creator
    this.joinRoom(roomId, options.creator);
    
    // Set room name if provided
    if (options.name) {
      this.sendStateEvent(roomId, 'm.room.name', '', {
        name: options.name,
      }, options.creator);
    }
    
    // Set topic if provided
    if (options.topic) {
      this.sendStateEvent(roomId, 'm.room.topic', '', {
        topic: options.topic,
      }, options.creator);
    }
    
    // Invite users
    if (options.invite) {
      for (const userId of options.invite) {
        this.inviteUser(roomId, userId, options.creator);
      }
    }
    
    console.log(`[MockMatrix] Room created: ${roomId} (${options.name || 'unnamed'})`);
    return room;
  }
  
  getRoom(roomId: string): MatrixRoom | undefined {
    return this.rooms.get(roomId);
  }
  
  listRooms(): MatrixRoom[] {
    return Array.from(this.rooms.values());
  }
  
  // ============ Membership ============
  
  joinRoom(roomId: string, userId: string, displayName?: string): MatrixEvent | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const member: MatrixMember = {
      user_id: userId,
      display_name: displayName,
      membership: 'join',
      since: Date.now(),
    };
    
    room.state.members.set(userId, member);
    
    return this.sendStateEvent(roomId, 'm.room.member', userId, {
      membership: 'join',
      displayname: displayName,
    }, userId);
  }
  
  leaveRoom(roomId: string, userId: string): MatrixEvent | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const member = room.state.members.get(userId);
    if (member) {
      member.membership = 'leave';
    }
    
    return this.sendStateEvent(roomId, 'm.room.member', userId, {
      membership: 'leave',
    }, userId);
  }
  
  inviteUser(roomId: string, userId: string, inviter: string): MatrixEvent | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const member: MatrixMember = {
      user_id: userId,
      membership: 'invite',
      since: Date.now(),
    };
    
    room.state.members.set(userId, member);
    
    return this.sendStateEvent(roomId, 'm.room.member', userId, {
      membership: 'invite',
    }, inviter);
  }
  
  // ============ Event Sending ============
  
  sendMessage(
    roomId: string,
    sender: string,
    content: {
      msgtype: string;
      body: string;
      format?: string;
      formatted_body?: string;
      [key: string]: unknown;
    }
  ): MatrixEvent | null {
    return this.sendEvent(roomId, 'm.room.message', content, sender);
  }
  
  sendEvent(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
    sender: string
  ): MatrixEvent | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`[MockMatrix] Room not found: ${roomId}`);
      return null;
    }
    
    const event: MatrixEvent = {
      event_id: this.generateEventId(),
      type,
      room_id: roomId,
      sender,
      origin_server_ts: Date.now(),
      content,
    };
    
    room.timeline.push(event);
    
    // Trim timeline if too long
    if (room.timeline.length > this.config.maxTimelineEvents) {
      room.timeline = room.timeline.slice(-this.config.maxTimelineEvents);
    }
    
    // Add to pending events for sync
    const pending = this.pendingEvents.get(roomId) || [];
    pending.push(event);
    this.pendingEvents.set(roomId, pending);
    
    // Notify handlers
    this.notifyHandlers(event, room);
    
    return event;
  }
  
  sendStateEvent(
    roomId: string,
    type: string,
    stateKey: string,
    content: Record<string, unknown>,
    sender: string
  ): MatrixEvent | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const event: MatrixEvent = {
      event_id: this.generateEventId(),
      type,
      room_id: roomId,
      sender,
      origin_server_ts: Date.now(),
      content,
      state_key: stateKey,
    };
    
    // Store as current state
    const stateKey2 = `${type}|${stateKey}`;
    room.stateEvents.set(stateKey2, event);
    
    // Also add to timeline
    room.timeline.push(event);
    
    // Add to pending
    const pending = this.pendingEvents.get(roomId) || [];
    pending.push(event);
    this.pendingEvents.set(roomId, pending);
    
    // Notify handlers
    this.notifyHandlers(event, room);
    
    return event;
  }
  
  // ============ Sync Simulation ============
  
  sync(since?: string): MatrixSyncResponse {
    this.syncToken++;
    const nextBatch = `s${this.syncToken}_${Date.now()}`;
    
    const joinedRooms: MatrixSyncResponse['rooms']['join'] = {};
    
    for (const [roomId, room] of this.rooms) {
      const pending = this.pendingEvents.get(roomId) || [];
      
      if (pending.length > 0 || !since) {
        // Separate state events from timeline events
        const stateEvents = pending.filter(e => e.state_key !== undefined);
        const timelineEvents = pending.filter(e => e.state_key === undefined);
        
        joinedRooms[roomId] = {
          timeline: {
            events: since ? timelineEvents : room.timeline.slice(-50),
            limited: !since && room.timeline.length > 50,
            prev_batch: since,
          },
          state: {
            events: since ? stateEvents : Array.from(room.stateEvents.values()),
          },
        };
      }
      
      // Clear pending events
      this.pendingEvents.set(roomId, []);
    }
    
    return {
      next_batch: nextBatch,
      rooms: {
        join: joinedRooms,
        invite: {},
        leave: {},
      },
    };
  }
  
  // ============ Event Handlers ============
  
  onEvent(handler: MatrixEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }
  
  private notifyHandlers(event: MatrixEvent, room: MatrixRoom): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event, room);
      } catch (err) {
        console.error('[MockMatrix] Event handler error:', err);
      }
    }
  }
  
  // ============ Timeline Access ============
  
  getRoomTimeline(roomId: string, limit = 100): MatrixEvent[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.timeline.slice(-limit);
  }
  
  searchEvents(query: {
    roomId?: string;
    sender?: string;
    type?: string;
    contentMatch?: string;
    since?: number;
    until?: number;
    limit?: number;
  }): MatrixEvent[] {
    let events: MatrixEvent[] = [];
    
    // Collect events from specified room or all rooms
    if (query.roomId) {
      const room = this.rooms.get(query.roomId);
      if (room) events = [...room.timeline];
    } else {
      for (const room of this.rooms.values()) {
        events.push(...room.timeline);
      }
    }
    
    // Filter
    if (query.sender) {
      events = events.filter(e => e.sender === query.sender);
    }
    if (query.type) {
      events = events.filter(e => e.type === query.type);
    }
    if (query.since) {
      events = events.filter(e => e.origin_server_ts >= query.since!);
    }
    if (query.until) {
      events = events.filter(e => e.origin_server_ts <= query.until!);
    }
    if (query.contentMatch) {
      const pattern = query.contentMatch.toLowerCase();
      events = events.filter(e => {
        const body = (e.content.body as string) || '';
        return body.toLowerCase().includes(pattern);
      });
    }
    
    // Sort by timestamp
    events.sort((a, b) => a.origin_server_ts - b.origin_server_ts);
    
    // Limit
    if (query.limit) {
      events = events.slice(-query.limit);
    }
    
    return events;
  }
  
  // ============ Export/Import ============
  
  exportState(): {
    config: MockMatrixConfig;
    rooms: Array<{
      room: Omit<MatrixRoom, 'stateEvents' | 'state'> & {
        state: Omit<MatrixRoomState, 'members'> & { members: [string, MatrixMember][] };
        stateEvents: [string, MatrixEvent][];
      };
    }>;
    users: [string, MatrixUserId][];
    eventCounter: number;
    syncToken: number;
  } {
    const rooms = Array.from(this.rooms.values()).map(room => ({
      room: {
        ...room,
        state: {
          ...room.state,
          members: Array.from(room.state.members.entries()),
        },
        stateEvents: Array.from(room.stateEvents.entries()),
      },
    }));
    
    return {
      config: this.config,
      rooms,
      users: Array.from(this.users.entries()),
      eventCounter: this.eventCounter,
      syncToken: this.syncToken,
    };
  }
  
  importState(state: ReturnType<MockMatrixServer['exportState']>): void {
    this.config = state.config;
    this.eventCounter = state.eventCounter;
    this.syncToken = state.syncToken;
    
    this.users.clear();
    for (const [key, value] of state.users) {
      this.users.set(key, value);
    }
    
    this.rooms.clear();
    for (const { room } of state.rooms) {
      const reconstructed: MatrixRoom = {
        room_id: room.room_id,
        timeline: room.timeline,
        createdAt: room.createdAt,
        version: room.version,
        state: {
          ...room.state,
          members: new Map(room.state.members),
        },
        stateEvents: new Map(room.stateEvents),
      };
      this.rooms.set(room.room_id, reconstructed);
      this.pendingEvents.set(room.room_id, []);
    }
    
    console.log(`[MockMatrix] State imported: ${this.rooms.size} rooms, ${this.users.size} users`);
  }
  
  // ============ Stats ============
  
  getStats(): {
    rooms: number;
    users: number;
    totalEvents: number;
    serverName: string;
  } {
    let totalEvents = 0;
    for (const room of this.rooms.values()) {
      totalEvents += room.timeline.length;
    }
    
    return {
      rooms: this.rooms.size,
      users: this.users.size,
      totalEvents,
      serverName: this.config.serverName,
    };
  }
}

// ============ Expert Matrix Bridge ============

export interface ExpertMatrixUser {
  expertId: string;
  userId: MatrixUserId;
  displayName: string;
  avatarEmoji: string;
}

class ExpertMatrixBridge {
  private server: MockMatrixServer;
  private expertUsers = new Map<string, ExpertMatrixUser>();
  private mainRoom: MatrixRoom | null = null;
  private systemUser: MatrixUserId;
  
  constructor(server: MockMatrixServer) {
    this.server = server;
    this.systemUser = server.createUserId('atlas-system');
  }
  
  initialize(): MatrixRoom {
    // Create the main expert discussion room
    this.mainRoom = this.server.createRoom({
      name: 'Atlas Expert Lounge',
      topic: 'Real-time expert observations and recommendations',
      creator: this.systemUser.full,
      preset: 'public_chat',
    });
    
    // Send welcome message
    this.server.sendMessage(this.mainRoom.room_id, this.systemUser.full, {
      msgtype: 'm.text',
      body: '🎭 Expert Lounge initialized. Experts will post their observations here.',
      format: 'org.matrix.custom.html',
      formatted_body: '<strong>🎭 Expert Lounge initialized.</strong> Experts will post their observations here.',
    });
    
    console.log(`[ExpertMatrixBridge] Initialized with room: ${this.mainRoom.room_id}`);
    return this.mainRoom;
  }
  
  registerExpert(expertId: string, name: string, avatar: string): ExpertMatrixUser {
    const localpart = `expert-${expertId.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
    const userId = this.server.createUserId(localpart);
    
    const expertUser: ExpertMatrixUser = {
      expertId,
      userId,
      displayName: name,
      avatarEmoji: avatar,
    };
    
    this.expertUsers.set(expertId, expertUser);
    
    // Join the main room
    if (this.mainRoom) {
      this.server.joinRoom(this.mainRoom.room_id, userId.full, name);
    }
    
    console.log(`[ExpertMatrixBridge] Registered expert: ${name} (${userId.full})`);
    return expertUser;
  }
  
  postThought(
    expertId: string,
    thought: {
      type: string;
      content: string;
      confidence: number;
      severity: string;
      contextRef?: unknown;
    }
  ): MatrixEvent | null {
    const expert = this.expertUsers.get(expertId);
    if (!expert || !this.mainRoom) return null;
    
    const severityEmoji: Record<string, string> = {
      info: 'ℹ️',
      low: '📝',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨',
    };
    
    const typeEmoji: Record<string, string> = {
      observation: '👁️',
      question: '❓',
      recommendation: '💡',
      concern: '⚠️',
      praise: '👍',
      prediction: '🔮',
    };
    
    const emoji = typeEmoji[thought.type] || '💭';
    const severity = severityEmoji[thought.severity] || '';
    
    return this.server.sendMessage(this.mainRoom.room_id, expert.userId.full, {
      msgtype: 'm.text',
      body: `${emoji} ${thought.content}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<span title="${thought.type}">${emoji}</span> ${thought.content} ${severity}`,
      // Custom Atlas fields
      'io.atlas.expert': {
        expertId,
        type: thought.type,
        confidence: thought.confidence,
        severity: thought.severity,
        contextRef: thought.contextRef,
        timestamp: Date.now(),
      },
    });
  }
  
  postBiddingResult(round: {
    resource: string;
    winners: string[];
    bids: Array<{ expertId: string; amount: number }>;
  }): MatrixEvent | null {
    if (!this.mainRoom) return null;
    
    const winnerNames = round.winners
      .map(id => this.expertUsers.get(id)?.displayName || id)
      .join(', ');
    
    return this.server.sendMessage(this.mainRoom.room_id, this.systemUser.full, {
      msgtype: 'm.notice',
      body: `🎫 Bidding round for ${round.resource}: Winners - ${winnerNames}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<em>🎫 Bidding round for <strong>${round.resource}</strong>: Winners - ${winnerNames}</em>`,
      'io.atlas.bidding': round,
    });
  }
  
  postSystemMessage(message: string, html?: string): MatrixEvent | null {
    if (!this.mainRoom) return null;
    
    return this.server.sendMessage(this.mainRoom.room_id, this.systemUser.full, {
      msgtype: 'm.notice',
      body: message,
      format: html ? 'org.matrix.custom.html' : undefined,
      formatted_body: html,
    });
  }
  
  getTimeline(limit = 100): MatrixEvent[] {
    if (!this.mainRoom) return [];
    return this.server.getRoomTimeline(this.mainRoom.room_id, limit);
  }
  
  getServer(): MockMatrixServer {
    return this.server;
  }
  
  getMainRoom(): MatrixRoom | null {
    return this.mainRoom;
  }
  
  getExpertUser(expertId: string): ExpertMatrixUser | undefined {
    return this.expertUsers.get(expertId);
  }
}

// ============ Singleton & Initialization ============

let mockMatrixServer: MockMatrixServer | null = null;
let expertMatrixBridge: ExpertMatrixBridge | null = null;

export function getMockMatrixServer(): MockMatrixServer {
  if (!mockMatrixServer) {
    mockMatrixServer = new MockMatrixServer({
      serverName: 'atlas.local',
    });
  }
  return mockMatrixServer;
}

export function getExpertMatrixBridge(): ExpertMatrixBridge {
  if (!expertMatrixBridge) {
    expertMatrixBridge = new ExpertMatrixBridge(getMockMatrixServer());
  }
  return expertMatrixBridge;
}

export function initMockMatrix(): { server: MockMatrixServer; bridge: ExpertMatrixBridge; room: MatrixRoom } {
  const server = getMockMatrixServer();
  const bridge = getExpertMatrixBridge();
  const room = bridge.initialize();
  
  console.log('[MockMatrix] Fully initialized');
  
  return { server, bridge, room };
}

// Export types and classes
export { MockMatrixServer, ExpertMatrixBridge };
