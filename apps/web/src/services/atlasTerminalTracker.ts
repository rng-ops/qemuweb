/**
 * Atlas Terminal Tracker
 * 
 * Tracks terminal commands and output, forwarding them to Atlas
 * for context awareness about what the user is doing.
 */

import { sendToAtlasIframe, createMainMessage } from './atlasIframeProtocol';
import type { TerminalCommandPayload, TerminalOutputPayload } from './atlasIframeProtocol';

interface CommandSession {
  sessionId: string;
  command: string;
  startTime: number;
  cwd?: string;
  outputBuffer: string[];
}

class AtlasTerminalTracker {
  private atlasIframe: HTMLIFrameElement | null = null;
  private activeSessions = new Map<string, CommandSession>();
  private sessionCounter = 0;

  /**
   * Set the Atlas iframe reference for sending messages
   */
  setIframe(iframe: HTMLIFrameElement | null): void {
    this.atlasIframe = iframe;
  }

  /**
   * Track a command being executed
   */
  trackCommand(command: string, cwd?: string): string {
    if (!this.atlasIframe?.contentWindow) return '';

    const sessionId = `term-${++this.sessionCounter}-${Date.now()}`;
    
    const session: CommandSession = {
      sessionId,
      command,
      startTime: Date.now(),
      cwd,
      outputBuffer: [],
    };

    this.activeSessions.set(sessionId, session);

    const payload: TerminalCommandPayload = {
      sessionId,
      command,
      timestamp: Date.now(),
      cwd,
      exitCode: null, // Still running
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.terminalCommand(payload));
    
    return sessionId;
  }

  /**
   * Track command output (streaming)
   */
  trackOutput(sessionId: string, output: string, streamType: 'stdout' | 'stderr' = 'stdout'): void {
    if (!this.atlasIframe?.contentWindow) return;

    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.outputBuffer.push(output);
    }

    const payload: TerminalOutputPayload = {
      sessionId,
      output,
      timestamp: Date.now(),
      streamType,
      isComplete: false,
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.terminalOutput(payload));
  }

  /**
   * Mark command as complete
   */
  completeCommand(sessionId: string, exitCode: number): void {
    if (!this.atlasIframe?.contentWindow) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Send final command update with exit code
    const cmdPayload: TerminalCommandPayload = {
      sessionId,
      command: session.command,
      timestamp: Date.now(),
      cwd: session.cwd,
      exitCode,
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.terminalCommand(cmdPayload));

    // Send completion marker for output
    const outPayload: TerminalOutputPayload = {
      sessionId,
      output: '', // Empty indicates completion
      timestamp: Date.now(),
      streamType: 'stdout',
      isComplete: true,
      exitCode,
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.terminalOutput(outPayload));

    // Clean up old sessions (keep last 10)
    const sessions = Array.from(this.activeSessions.keys());
    if (sessions.length > 10) {
      this.activeSessions.delete(sessions[0]);
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): CommandSession | undefined {
    return this.activeSessions.get(sessionId);
  }
}

// Singleton instance
let instance: AtlasTerminalTracker | null = null;

export function getTerminalTracker(): AtlasTerminalTracker {
  if (!instance) {
    instance = new AtlasTerminalTracker();
  }
  return instance;
}
