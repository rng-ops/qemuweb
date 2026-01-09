/**
 * DOM Observer Service
 * 
 * Provides AI agents with awareness of:
 * - Visual state changes in the browser
 * - IndexedDB metadata and updates
 * - Network activity and container states
 * - User interactions and navigation
 */

import { openDB } from 'idb';

// Types for DOM observation
export interface DOMSnapshot {
  timestamp: number;
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  scrollPosition: { x: number; y: number };
  activeElement: string | null;
  visibleElements: VisibleElement[];
  modals: ModalInfo[];
  forms: FormState[];
  interactiveElements: InteractiveElement[];
}

export interface VisibleElement {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  rect: { x: number; y: number; width: number; height: number };
  isInteractive: boolean;
  role?: string;
  ariaLabel?: string;
}

export interface ModalInfo {
  id?: string;
  title?: string;
  isOpen: boolean;
  type: 'dialog' | 'dropdown' | 'popup' | 'overlay';
}

export interface FormState {
  id?: string;
  name?: string;
  fields: FormFieldState[];
  isValid: boolean;
  hasChanges: boolean;
}

export interface FormFieldState {
  name: string;
  type: string;
  value: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface InteractiveElement {
  selector: string;
  type: 'button' | 'link' | 'input' | 'select' | 'tab' | 'menu-item';
  label: string;
  isEnabled: boolean;
  isVisible: boolean;
}

export interface UIChange {
  timestamp: number;
  type: 'navigation' | 'modal' | 'form' | 'content' | 'layout' | 'error';
  description: string;
  oldValue?: string;
  newValue?: string;
  affectedElement?: string;
}

export interface IndexedDBState {
  databases: DatabaseInfo[];
  totalSize: number;
  lastUpdated: number;
}

export interface DatabaseInfo {
  name: string;
  version: number;
  objectStores: ObjectStoreInfo[];
}

export interface ObjectStoreInfo {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  recordCount: number;
  indexes: string[];
}

// Observer callbacks
type SnapshotCallback = (snapshot: DOMSnapshot) => void;
type ChangeCallback = (change: UIChange) => void;
type IndexedDBCallback = (state: IndexedDBState) => void;

/**
 * DOM Observer Class
 * Tracks visual changes and provides context to AI agents
 */
class DOMObserverService {
  private observer: MutationObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  private snapshotCallbacks: Set<SnapshotCallback> = new Set();
  private changeCallbacks: Set<ChangeCallback> = new Set();
  private indexedDBCallbacks: Set<IndexedDBCallback> = new Set();
  
  private lastSnapshot: DOMSnapshot | null = null;
  private changeHistory: UIChange[] = [];
  private maxHistorySize = 100;
  
  private isObserving = false;
  private snapshotInterval: NodeJS.Timeout | null = null;

  /**
   * Start observing DOM changes
   */
  start(options: { snapshotIntervalMs?: number } = {}): void {
    if (this.isObserving) return;
    
    const { snapshotIntervalMs = 1000 } = options;
    
    // Mutation observer for DOM changes
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-hidden'],
    });
    
    // Intersection observer for visibility
    this.intersectionObserver = new IntersectionObserver(
      this.handleIntersections.bind(this),
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    
    // Observe key elements
    document.querySelectorAll('[role="dialog"], [role="menu"], .modal, .popup').forEach((el) => {
      this.intersectionObserver?.observe(el);
    });
    
    // Resize observer for layout changes
    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(document.body);
    
    // Periodic snapshots
    this.snapshotInterval = setInterval(() => {
      this.captureSnapshot();
    }, snapshotIntervalMs);
    
    // Initial snapshot
    this.captureSnapshot();
    
    // Listen for navigation events
    window.addEventListener('popstate', this.handleNavigation.bind(this));
    window.addEventListener('hashchange', this.handleNavigation.bind(this));
    
    // Listen for form changes
    document.addEventListener('input', this.handleFormInput.bind(this));
    document.addEventListener('change', this.handleFormChange.bind(this));
    
    // Listen for focus changes
    document.addEventListener('focusin', this.handleFocusChange.bind(this));
    
    // Listen for errors
    window.addEventListener('error', this.handleError.bind(this));
    window.addEventListener('unhandledrejection', this.handleError.bind(this));
    
    this.isObserving = true;
    console.log('[DOMObserver] Started observing');
  }

  /**
   * Stop observing DOM changes
   */
  stop(): void {
    this.observer?.disconnect();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }
    
    window.removeEventListener('popstate', this.handleNavigation.bind(this));
    window.removeEventListener('hashchange', this.handleNavigation.bind(this));
    document.removeEventListener('input', this.handleFormInput.bind(this));
    document.removeEventListener('change', this.handleFormChange.bind(this));
    document.removeEventListener('focusin', this.handleFocusChange.bind(this));
    window.removeEventListener('error', this.handleError.bind(this));
    window.removeEventListener('unhandledrejection', this.handleError.bind(this));
    
    this.isObserving = false;
    console.log('[DOMObserver] Stopped observing');
  }

  /**
   * Subscribe to snapshot updates
   */
  onSnapshot(callback: SnapshotCallback): () => void {
    this.snapshotCallbacks.add(callback);
    return () => this.snapshotCallbacks.delete(callback);
  }

  /**
   * Subscribe to change events
   */
  onChange(callback: ChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  /**
   * Subscribe to IndexedDB state updates
   */
  onIndexedDBUpdate(callback: IndexedDBCallback): () => void {
    this.indexedDBCallbacks.add(callback);
    return () => this.indexedDBCallbacks.delete(callback);
  }

  /**
   * Get current DOM snapshot
   */
  getSnapshot(): DOMSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Get change history
   */
  getChangeHistory(): UIChange[] {
    return [...this.changeHistory];
  }

  /**
   * Get IndexedDB state
   */
  async getIndexedDBState(): Promise<IndexedDBState> {
    const databases: DatabaseInfo[] = [];
    let totalSize = 0;
    
    try {
      // Get list of databases
      const dbList = await indexedDB.databases();
      
      for (const dbInfo of dbList) {
        if (!dbInfo.name) continue;
        
        try {
          const db = await openDB(dbInfo.name);
          const objectStores: ObjectStoreInfo[] = [];
          
          for (const storeName of db.objectStoreNames) {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const count = await store.count();
            
            objectStores.push({
              name: storeName,
              keyPath: store.keyPath,
              autoIncrement: store.autoIncrement,
              recordCount: count,
              indexes: Array.from(store.indexNames),
            });
          }
          
          databases.push({
            name: dbInfo.name,
            version: db.version,
            objectStores,
          });
          
          db.close();
        } catch (e) {
          console.warn(`[DOMObserver] Failed to inspect database ${dbInfo.name}:`, e);
        }
      }
      
      // Estimate storage usage
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        totalSize = estimate.usage || 0;
      }
    } catch (e) {
      console.warn('[DOMObserver] Failed to get IndexedDB state:', e);
    }
    
    const state: IndexedDBState = {
      databases,
      totalSize,
      lastUpdated: Date.now(),
    };
    
    // Notify subscribers
    this.indexedDBCallbacks.forEach((cb) => cb(state));
    
    return state;
  }

  /**
   * Capture current DOM snapshot
   */
  private captureSnapshot(): void {
    const visibleElements: VisibleElement[] = [];
    const modals: ModalInfo[] = [];
    const forms: FormState[] = [];
    const interactiveElements: InteractiveElement[] = [];
    
    // Get all visible elements
    const elements = document.querySelectorAll('*');
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && 
        rect.top < window.innerHeight && rect.bottom > 0 &&
        rect.left < window.innerWidth && rect.right > 0;
      
      if (!isVisible) return;
      
      const isInteractive = this.isInteractiveElement(el as HTMLElement);
      
      // Only include significant elements
      if (isInteractive || el.id || (el as HTMLElement).role) {
        visibleElements.push({
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className || undefined,
          text: (el.textContent || '').slice(0, 100).trim() || undefined,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          isInteractive,
          role: (el as HTMLElement).role || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
        });
      }
      
      // Track modals
      if ((el as HTMLElement).role === 'dialog' || el.classList.contains('modal')) {
        modals.push({
          id: el.id || undefined,
          title: el.querySelector('[role="heading"], h1, h2, h3')?.textContent || undefined,
          isOpen: !el.hasAttribute('hidden') && (el as HTMLElement).style.display !== 'none',
          type: 'dialog',
        });
      }
      
      // Track interactive elements
      if (isInteractive) {
        interactiveElements.push(this.getInteractiveElementInfo(el as HTMLElement));
      }
    });
    
    // Get forms
    document.querySelectorAll('form').forEach((form) => {
      forms.push(this.getFormState(form));
    });
    
    const snapshot: DOMSnapshot = {
      timestamp: Date.now(),
      url: window.location.href,
      title: document.title,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollPosition: { x: window.scrollX, y: window.scrollY },
      activeElement: document.activeElement?.id || document.activeElement?.tagName.toLowerCase() || null,
      visibleElements: visibleElements.slice(0, 100), // Limit to 100 elements
      modals,
      forms,
      interactiveElements: interactiveElements.slice(0, 50), // Limit to 50
    };
    
    this.lastSnapshot = snapshot;
    this.snapshotCallbacks.forEach((cb) => cb(snapshot));
  }

  private isInteractiveElement(el: HTMLElement): boolean {
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'option'];
    const interactiveRoles = ['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio'];
    
    return (
      interactiveTags.includes(el.tagName.toLowerCase()) ||
      interactiveRoles.includes(el.role || '') ||
      el.tabIndex >= 0 ||
      el.hasAttribute('onclick') ||
      el.classList.contains('clickable') ||
      el.classList.contains('interactive')
    );
  }

  private getInteractiveElementInfo(el: HTMLElement): InteractiveElement {
    const tagName = el.tagName.toLowerCase();
    let type: InteractiveElement['type'] = 'button';
    
    if (tagName === 'a') type = 'link';
    else if (['input', 'textarea'].includes(tagName)) type = 'input';
    else if (tagName === 'select') type = 'select';
    else if (el.role === 'tab') type = 'tab';
    else if (el.role === 'menuitem') type = 'menu-item';
    
    return {
      selector: this.getSelector(el),
      type,
      label: el.ariaLabel || el.textContent?.slice(0, 50).trim() || el.id || tagName,
      isEnabled: !el.hasAttribute('disabled'),
      isVisible: el.offsetParent !== null,
    };
  }

  private getFormState(form: HTMLFormElement): FormState {
    const fields: FormFieldState[] = [];
    
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      const input = field as HTMLInputElement;
      fields.push({
        name: input.name || input.id || '',
        type: input.type || 'text',
        value: input.type === 'password' ? '***' : input.value.slice(0, 100),
        isValid: input.checkValidity(),
        errorMessage: input.validationMessage || undefined,
      });
    });
    
    return {
      id: form.id || undefined,
      name: form.name || undefined,
      fields,
      isValid: form.checkValidity(),
      hasChanges: false, // Would need to track initial state
    };
  }

  private getSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    
    const path: string[] = [];
    let current: HTMLElement | null = el;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }
      if (current.className) {
        selector += `.${current.className.split(' ').slice(0, 2).join('.')}`;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.slice(-3).join(' > ');
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check for modals/dialogs being added
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.role === 'dialog' || node.classList.contains('modal')) {
              this.emitChange({
                timestamp: Date.now(),
                type: 'modal',
                description: 'Modal opened',
                newValue: node.id || 'unnamed modal',
              });
            }
          }
        });
      }
      
      if (mutation.type === 'attributes') {
        const target = mutation.target as HTMLElement;
        if (mutation.attributeName === 'class') {
          // Detect visibility changes
          if (target.classList.contains('hidden') || target.style.display === 'none') {
            this.emitChange({
              timestamp: Date.now(),
              type: 'content',
              description: 'Element hidden',
              affectedElement: this.getSelector(target),
            });
          }
        }
      }
    }
  }

  private handleIntersections(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        this.emitChange({
          timestamp: Date.now(),
          type: 'content',
          description: 'Element became visible',
          affectedElement: this.getSelector(entry.target as HTMLElement),
        });
      }
    }
  }

  private handleResize(): void {
    this.emitChange({
      timestamp: Date.now(),
      type: 'layout',
      description: 'Viewport resized',
      newValue: `${window.innerWidth}x${window.innerHeight}`,
    });
  }

  private handleNavigation(): void {
    this.emitChange({
      timestamp: Date.now(),
      type: 'navigation',
      description: 'Page navigation',
      newValue: window.location.href,
    });
  }

  private handleFormInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (target.type === 'password') return; // Don't log password changes
    
    this.emitChange({
      timestamp: Date.now(),
      type: 'form',
      description: 'Form input changed',
      affectedElement: target.name || target.id || 'unnamed field',
      newValue: target.value.slice(0, 20) + (target.value.length > 20 ? '...' : ''),
    });
  }

  private handleFormChange(e: Event): void {
    const target = e.target as HTMLSelectElement | HTMLInputElement;
    this.emitChange({
      timestamp: Date.now(),
      type: 'form',
      description: 'Form field changed',
      affectedElement: target.name || target.id || 'unnamed field',
    });
  }

  private handleFocusChange(e: FocusEvent): void {
    const target = e.target as HTMLElement;
    this.emitChange({
      timestamp: Date.now(),
      type: 'content',
      description: 'Focus changed',
      newValue: this.getSelector(target),
    });
  }

  private handleError(e: Event | PromiseRejectionEvent): void {
    const message = e instanceof ErrorEvent ? e.message : 
      'reason' in e && e.reason ? String(e.reason) : 'Unknown error';
    
    this.emitChange({
      timestamp: Date.now(),
      type: 'error',
      description: 'Error occurred',
      newValue: message.slice(0, 100),
    });
  }

  private emitChange(change: UIChange): void {
    this.changeHistory.push(change);
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
    this.changeCallbacks.forEach((cb) => cb(change));
  }

  /**
   * Get a summary suitable for AI context
   */
  async getAgentContext(): Promise<{
    domSnapshot: DOMSnapshot | null;
    recentChanges: UIChange[];
    indexedDBState: IndexedDBState;
    summary: string;
  }> {
    const indexedDBState = await this.getIndexedDBState();
    const recentChanges = this.changeHistory.slice(-10);
    
    // Generate natural language summary
    const summary = this.generateSummary(this.lastSnapshot, recentChanges, indexedDBState);
    
    return {
      domSnapshot: this.lastSnapshot,
      recentChanges,
      indexedDBState,
      summary,
    };
  }

  private generateSummary(
    snapshot: DOMSnapshot | null,
    changes: UIChange[],
    indexedDB: IndexedDBState
  ): string {
    const parts: string[] = [];
    
    if (snapshot) {
      parts.push(`Current page: "${snapshot.title}" at ${snapshot.url}`);
      parts.push(`Viewport: ${snapshot.viewportWidth}x${snapshot.viewportHeight}`);
      
      if (snapshot.modals.filter(m => m.isOpen).length > 0) {
        parts.push(`Open modals: ${snapshot.modals.filter(m => m.isOpen).map(m => m.title || m.id).join(', ')}`);
      }
      
      if (snapshot.forms.length > 0) {
        const invalidForms = snapshot.forms.filter(f => !f.isValid);
        if (invalidForms.length > 0) {
          parts.push(`Forms with errors: ${invalidForms.length}`);
        }
      }
      
      parts.push(`Interactive elements: ${snapshot.interactiveElements.length}`);
    }
    
    if (changes.length > 0) {
      const errorCount = changes.filter(c => c.type === 'error').length;
      if (errorCount > 0) {
        parts.push(`Recent errors: ${errorCount}`);
      }
      
      const lastChange = changes[changes.length - 1];
      parts.push(`Last change: ${lastChange.description} ${lastChange.newValue ? `(${lastChange.newValue})` : ''}`);
    }
    
    if (indexedDB.databases.length > 0) {
      const totalRecords = indexedDB.databases.reduce(
        (sum, db) => sum + db.objectStores.reduce((s, os) => s + os.recordCount, 0),
        0
      );
      parts.push(`IndexedDB: ${indexedDB.databases.length} databases, ${totalRecords} total records`);
    }
    
    return parts.join('\n');
  }
}

// Singleton instance
export const domObserver = new DOMObserverService();

export default domObserver;
