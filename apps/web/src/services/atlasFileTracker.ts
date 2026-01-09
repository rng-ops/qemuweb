/**
 * Atlas File Tracker
 * 
 * Tracks file operations (open, save, update) and forwards them to Atlas
 * for context awareness. Also generates diffs when files change.
 */

import { FileMetadata } from '@qemuweb/storage';
import { sendToAtlasIframe, createMainMessage } from './atlasIframeProtocol';
import type { FileEventPayload, FileUpdatePayload, FileDiffPayload } from './atlasIframeProtocol';

// Track file content for diff generation
interface FileSnapshot {
  fileId: string;
  content: string;
  timestamp: number;
}

class AtlasFileTracker {
  private fileSnapshots = new Map<string, FileSnapshot>();
  private atlasIframe: HTMLIFrameElement | null = null;

  /**
   * Set the Atlas iframe reference for sending messages
   */
  setIframe(iframe: HTMLIFrameElement | null): void {
    this.atlasIframe = iframe;
  }

  /**
   * Track file open event
   */
  trackFileOpen(file: FileMetadata, contentPreview?: string): void {
    if (!this.atlasIframe?.contentWindow) return;

    const payload: FileEventPayload = {
      fileId: file.id,
      fileName: file.name,
      filePath: file.name, // TODO: Get full path if available
      fileType: file.type,
      timestamp: Date.now(),
      size: file.size,
      contentPreview: contentPreview?.slice(0, 500),
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.fileOpen(payload));
  }

  /**
   * Track file save event
   */
  trackFileSave(file: FileMetadata, content?: string): void {
    if (!this.atlasIframe?.contentWindow) return;

    // Generate diff if we have previous content
    const previousSnapshot = this.fileSnapshots.get(file.id);
    if (previousSnapshot && content) {
      this.generateAndSendDiff(file, previousSnapshot.content, content);
    }

    // Update snapshot
    if (content) {
      this.fileSnapshots.set(file.id, {
        fileId: file.id,
        content,
        timestamp: Date.now(),
      });
    }

    const payload: FileEventPayload = {
      fileId: file.id,
      fileName: file.name,
      filePath: file.name,
      fileType: file.type,
      timestamp: Date.now(),
      size: file.size,
      contentPreview: content?.slice(0, 500),
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.fileSave(payload));
  }

  /**
   * Track file update (edit in progress)
   */
  trackFileUpdate(
    file: FileMetadata,
    changeType: 'edit' | 'create' | 'delete' | 'rename',
    content?: string,
    linesChanged?: number
  ): void {
    if (!this.atlasIframe?.contentWindow) return;

    // Store initial snapshot on first edit
    if (changeType === 'edit' && !this.fileSnapshots.has(file.id) && content) {
      this.fileSnapshots.set(file.id, {
        fileId: file.id,
        content,
        timestamp: Date.now(),
      });
    }

    const payload: FileUpdatePayload = {
      fileId: file.id,
      fileName: file.name,
      filePath: file.name,
      fileType: file.type,
      timestamp: Date.now(),
      size: file.size,
      contentPreview: content?.slice(0, 500),
      changeType,
      linesChanged,
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.fileUpdate(payload));
  }

  /**
   * Generate and send a diff between old and new content
   */
  private generateAndSendDiff(file: FileMetadata, oldContent: string, newContent: string): void {
    if (!this.atlasIframe?.contentWindow) return;

    // Simple line-based diff
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    let additions = 0;
    let deletions = 0;
    const diffLines: string[] = [];

    // Very simple diff - just count changes
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= oldLines.length) {
        additions++;
        diffLines.push(`+ ${newLines[i]}`);
      } else if (i >= newLines.length) {
        deletions++;
        diffLines.push(`- ${oldLines[i]}`);
      } else if (oldLines[i] !== newLines[i]) {
        deletions++;
        additions++;
        diffLines.push(`- ${oldLines[i]}`);
        diffLines.push(`+ ${newLines[i]}`);
      } else {
        diffLines.push(`  ${oldLines[i]}`);
      }
    }

    const diff = diffLines.slice(0, 100).join('\n'); // Limit to 100 lines

    const payload: FileDiffPayload = {
      fileId: file.id,
      fileName: file.name,
      filePath: file.name,
      timestamp: Date.now(),
      diff,
      additions,
      deletions,
      beforePreview: oldContent.slice(0, 500),
      afterPreview: newContent.slice(0, 500),
    };

    sendToAtlasIframe(this.atlasIframe.contentWindow, createMainMessage.fileDiff(payload));
  }

  /**
   * Clear snapshot for a file (e.g., when closed)
   */
  clearSnapshot(fileId: string): void {
    this.fileSnapshots.delete(fileId);
  }

  /**
   * Clear all snapshots
   */
  clearAllSnapshots(): void {
    this.fileSnapshots.clear();
  }
}

// Singleton instance
let instance: AtlasFileTracker | null = null;

export function getFileTracker(): AtlasFileTracker {
  if (!instance) {
    instance = new AtlasFileTracker();
  }
  return instance;
}
