/**
 * Accessibility Events Service
 * 
 * Captures DOM events with accessibility context for:
 * - Screen reader announcements (ARIA live regions)
 * - Focus management events
 * - Semantic structure changes
 * - User interaction patterns
 * 
 * All events follow WCAG 2.1 best practices and can be
 * consumed by both assistive technologies and the Atlas agent.
 */

import { v4 as uuidv4 } from 'uuid';

// ============ Types ============

export type A11yEventType =
  | 'focus-change'           // Focus moved to new element
  | 'focus-trap-enter'       // Entered a focus trap (modal, menu)
  | 'focus-trap-exit'        // Exited a focus trap
  | 'live-region-update'     // ARIA live region content changed
  | 'announcement'           // Screen reader announcement
  | 'landmark-enter'         // Navigated to landmark region
  | 'landmark-exit'          // Left landmark region
  | 'expansion-change'       // Expanded/collapsed state change
  | 'selection-change'       // Selection changed (listbox, grid)
  | 'value-change'           // Value changed (slider, input)
  | 'state-change'           // Checked, pressed, disabled, etc.
  | 'error-announce'         // Error message announced
  | 'progress-update'        // Progress indicator update
  | 'navigation'             // Page/view navigation
  | 'modal-open'             // Modal dialog opened
  | 'modal-close'            // Modal dialog closed
  | 'tooltip-show'           // Tooltip displayed
  | 'tooltip-hide'           // Tooltip hidden
  | 'menu-open'              // Menu opened
  | 'menu-close'             // Menu closed
  | 'tree-expand'            // Tree node expanded
  | 'tree-collapse'          // Tree node collapsed
  | 'drag-start'             // Drag operation started
  | 'drag-end'               // Drag operation ended
  | 'sort-change'            // Sort order changed
  | 'filter-change'          // Filter applied/removed
  | 'page-load'              // Page/component loaded
  | 'content-update';        // Significant content update

export type A11yEventPriority = 'critical' | 'high' | 'medium' | 'low' | 'debug';

export type A11yLiveRegionPoliteness = 'off' | 'polite' | 'assertive';

export interface A11yEvent {
  id: string;
  timestamp: number;
  type: A11yEventType;
  priority: A11yEventPriority;
  
  // Element context
  element?: {
    tagName: string;
    role?: string;
    ariaLabel?: string;
    ariaDescribedBy?: string;
    id?: string;
    className?: string;
    textContent?: string;
    selector?: string;
  };
  
  // Event details
  details: {
    description: string;
    oldValue?: string;
    newValue?: string;
    announcement?: string;
    politeness?: A11yLiveRegionPoliteness;
  };
  
  // Accessibility context
  a11y: {
    landmark?: string;        // Current landmark (main, nav, etc.)
    heading?: string;         // Nearest heading
    headingLevel?: number;
    inFocusTrap?: boolean;
    inModal?: boolean;
    focusPath?: string[];     // Path of focus changes
  };
  
  // Batching metadata
  batch?: {
    groupId?: string;
    sequenceIndex?: number;
    canBatch?: boolean;
    batchKey?: string;        // Key for deduplication
  };
}

export interface A11yEventBatch {
  id: string;
  startTime: number;
  endTime: number;
  events: A11yEvent[];
  summary: string;
  priority: A11yEventPriority;
}

export interface A11yObserverConfig {
  // Observation mode
  mode: 'timer' | 'event-driven' | 'hybrid';
  
  // Timer mode settings
  timerInterval: number;      // ms between checks
  maxBatchSize: number;       // Max events per batch
  batchTimeout: number;       // ms to wait before flushing batch
  
  // Event filtering
  enabledEventTypes: A11yEventType[];
  minPriority: A11yEventPriority;
  
  // DOM observation
  observeMutations: boolean;
  observeFocus: boolean;
  observeAriaChanges: boolean;
  observeKeyboard: boolean;
  observeMouse: boolean;
  
  // Live region handling
  captureAnnouncements: boolean;
  announcementDebounce: number;
  
  // Performance
  throttleMs: number;
  maxEventsPerSecond: number;
}

// ============ Default Configuration ============

export const DEFAULT_A11Y_CONFIG: A11yObserverConfig = {
  mode: 'hybrid',
  timerInterval: 2000,
  maxBatchSize: 20,
  batchTimeout: 500,
  enabledEventTypes: [
    'focus-change', 'live-region-update', 'announcement',
    'modal-open', 'modal-close', 'navigation', 'error-announce',
    'expansion-change', 'state-change', 'value-change',
  ],
  minPriority: 'low',
  observeMutations: true,
  observeFocus: true,
  observeAriaChanges: true,
  observeKeyboard: true,
  observeMouse: false, // Can be noisy
  captureAnnouncements: true,
  announcementDebounce: 100,
  throttleMs: 50,
  maxEventsPerSecond: 30,
};

// ============ Priority Levels ============

const PRIORITY_ORDER: Record<A11yEventPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  debug: 4,
};

const EVENT_PRIORITY_MAP: Record<A11yEventType, A11yEventPriority> = {
  'error-announce': 'critical',
  'modal-open': 'high',
  'modal-close': 'high',
  'focus-trap-enter': 'high',
  'focus-trap-exit': 'high',
  'announcement': 'high',
  'live-region-update': 'medium',
  'navigation': 'medium',
  'focus-change': 'medium',
  'landmark-enter': 'medium',
  'landmark-exit': 'low',
  'expansion-change': 'medium',
  'selection-change': 'medium',
  'value-change': 'low',
  'state-change': 'low',
  'progress-update': 'low',
  'tooltip-show': 'low',
  'tooltip-hide': 'debug',
  'menu-open': 'medium',
  'menu-close': 'low',
  'tree-expand': 'low',
  'tree-collapse': 'low',
  'drag-start': 'medium',
  'drag-end': 'medium',
  'sort-change': 'medium',
  'filter-change': 'medium',
  'page-load': 'high',
  'content-update': 'low',
};

// ============ Accessibility Events Service ============

class AccessibilityEventsService {
  private config: A11yObserverConfig = DEFAULT_A11Y_CONFIG;
  private isObserving = false;
  
  // Observers
  private mutationObserver: MutationObserver | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  
  // Event storage
  private eventQueue: A11yEvent[] = [];
  private currentBatch: A11yEvent[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private batches: A11yEventBatch[] = [];
  private maxBatchHistory = 100;
  
  // Callbacks
  private eventCallbacks: Set<(event: A11yEvent) => void> = new Set();
  private batchCallbacks: Set<(batch: A11yEventBatch) => void> = new Set();
  
  // State tracking
  private lastFocusedElement: Element | null = null;
  private currentLandmark: string | null = null;
  private focusPath: string[] = [];
  private inFocusTrap = false;
  private inModal = false;
  
  // Rate limiting
  private eventCount = 0;
  private lastEventCountReset = Date.now();
  private lastEventTime = 0;
  
  // Live region tracking
  private liveRegions: Map<Element, string> = new Map();
  private announcementQueue: string[] = [];
  private debugMode = false; // Set to true for console logging
  
  // ============ Initialization ============
  
  start(config?: Partial<A11yObserverConfig>): void {
    if (this.isObserving) return;
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.setupObservers();
    this.setupEventListeners();
    this.scanForLiveRegions();
    
    if (this.config.mode === 'timer' || this.config.mode === 'hybrid') {
      this.startTimer();
    }
    
    this.isObserving = true;
    
    // Emit initial page load event
    this.emit({
      type: 'page-load',
      priority: 'high',
      details: {
        description: `Page loaded: ${document.title}`,
        newValue: window.location.pathname,
      },
      a11y: {
        landmark: this.detectLandmark(document.body) ?? undefined,
      },
    });
    
    if (this.debugMode) {
      // eslint-disable-next-line no-console
      console.log('[A11yEvents] Started observing with config:', this.config.mode);
    }
  }
  
  stop(): void {
    this.mutationObserver?.disconnect();
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.batchTimeout) clearTimeout(this.batchTimeout);
    
    this.removeEventListeners();
    this.isObserving = false;
    if (this.debugMode) {
      // eslint-disable-next-line no-console
      console.log('[A11yEvents] Stopped observing');
    }
  }
  
  // ============ Configuration ============
  
  updateConfig(updates: Partial<A11yObserverConfig>): void {
    const oldMode = this.config.mode;
    this.config = { ...this.config, ...updates };
    
    // Restart timer if mode changed
    if (updates.mode && updates.mode !== oldMode) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      
      if (this.config.mode === 'timer' || this.config.mode === 'hybrid') {
        this.startTimer();
      }
    }
    
    // Update timer interval if changed
    if (updates.timerInterval && this.timerInterval) {
      clearInterval(this.timerInterval);
      this.startTimer();
    }
  }
  
  getConfig(): A11yObserverConfig {
    return { ...this.config };
  }
  
  // ============ Observers Setup ============
  
  private setupObservers(): void {
    if (!this.config.observeMutations) return;
    
    this.mutationObserver = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
    
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'aria-hidden', 'aria-expanded', 'aria-selected', 'aria-checked',
        'aria-pressed', 'aria-disabled', 'aria-live', 'aria-atomic',
        'aria-busy', 'aria-current', 'aria-invalid', 'aria-label',
        'role', 'hidden', 'disabled', 'open', 'data-state',
      ],
      characterData: true,
    });
  }
  
  private setupEventListeners(): void {
    if (this.config.observeFocus) {
      document.addEventListener('focusin', this.handleFocusIn);
      document.addEventListener('focusout', this.handleFocusOut);
    }
    
    if (this.config.observeKeyboard) {
      document.addEventListener('keydown', this.handleKeyDown);
    }
    
    if (this.config.observeMouse) {
      document.addEventListener('click', this.handleClick);
    }
    
    // Navigation events
    window.addEventListener('popstate', this.handleNavigation);
    window.addEventListener('hashchange', this.handleNavigation);
  }
  
  private removeEventListeners(): void {
    document.removeEventListener('focusin', this.handleFocusIn);
    document.removeEventListener('focusout', this.handleFocusOut);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleClick);
    window.removeEventListener('popstate', this.handleNavigation);
    window.removeEventListener('hashchange', this.handleNavigation);
  }
  
  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.processTimerTick();
    }, this.config.timerInterval);
  }
  
  // ============ Event Handlers ============
  
  private handleFocusIn = (e: FocusEvent): void => {
    const target = e.target as Element;
    if (!target) return;
    
    const prevElement = this.lastFocusedElement;
    this.lastFocusedElement = target;
    
    // Track focus path
    const selector = this.getElementSelector(target);
    this.focusPath.push(selector);
    if (this.focusPath.length > 20) {
      this.focusPath = this.focusPath.slice(-20);
    }
    
    // Detect landmark changes
    const newLandmark = this.detectLandmark(target);
    const landmarkChanged = newLandmark !== this.currentLandmark;
    
    if (landmarkChanged && this.currentLandmark) {
      this.emit({
        type: 'landmark-exit',
        priority: 'low',
        element: this.getElementInfo(prevElement),
        details: {
          description: `Left ${this.currentLandmark} region`,
          oldValue: this.currentLandmark,
        },
        a11y: {
          landmark: this.currentLandmark,
        },
      });
    }
    
    this.currentLandmark = newLandmark;
    
    // Check for focus trap (modal, menu)
    const inFocusTrap = this.isInFocusTrap(target);
    if (inFocusTrap !== this.inFocusTrap) {
      this.inFocusTrap = inFocusTrap;
      this.emit({
        type: inFocusTrap ? 'focus-trap-enter' : 'focus-trap-exit',
        priority: 'high',
        element: this.getElementInfo(target),
        details: {
          description: inFocusTrap ? 'Entered focus trap' : 'Exited focus trap',
        },
        a11y: {
          inFocusTrap,
          inModal: this.inModal,
        },
      });
    }
    
    // Emit focus change
    this.emit({
      type: 'focus-change',
      priority: 'medium',
      element: this.getElementInfo(target),
      details: {
        description: this.describeFocusChange(target),
        oldValue: prevElement ? this.getElementSelector(prevElement) : undefined,
        newValue: selector,
      },
      a11y: {
        landmark: newLandmark || undefined,
        heading: this.getNearestHeading(target),
        inFocusTrap: this.inFocusTrap,
        inModal: this.inModal,
        focusPath: [...this.focusPath],
      },
    });
    
    if (landmarkChanged && newLandmark) {
      this.emit({
        type: 'landmark-enter',
        priority: 'medium',
        element: this.getElementInfo(target),
        details: {
          description: `Entered ${newLandmark} region`,
          newValue: newLandmark,
        },
        a11y: {
          landmark: newLandmark,
        },
      });
    }
  };
  
  private handleFocusOut = (_e: FocusEvent): void => {
    // Focus out is handled by next focus in
  };
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    // Track Escape key for modal/menu close
    if (e.key === 'Escape') {
      if (this.inModal) {
        // Modal close will be detected via mutation observer
      }
    }
    
    // Track Enter/Space for activations
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as Element;
      const role = target.getAttribute('role');
      
      if (role === 'button' || role === 'menuitem' || role === 'tab') {
        // Activation will trigger state changes detected by mutation observer
      }
    }
  };
  
  private handleClick = (e: MouseEvent): void => {
    const target = e.target as Element;
    if (!target) return;
    
    // Only track significant clicks
    const role = target.getAttribute('role');
    const tagName = target.tagName.toLowerCase();
    
    if (role === 'button' || tagName === 'button' || tagName === 'a') {
      // Button/link clicks will trigger other events
    }
  };
  
  private handleNavigation = (): void => {
    this.emit({
      type: 'navigation',
      priority: 'medium',
      details: {
        description: `Navigated to ${document.title}`,
        newValue: window.location.pathname + window.location.hash,
      },
      a11y: {},
    });
  };
  
  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        this.handleAttributeMutation(mutation);
      } else if (mutation.type === 'childList') {
        this.handleChildListMutation(mutation);
      } else if (mutation.type === 'characterData') {
        this.handleCharacterDataMutation(mutation);
      }
    }
  }
  
  private handleAttributeMutation(mutation: MutationRecord): void {
    const target = mutation.target as Element;
    const attr = mutation.attributeName;
    
    if (!attr) return;
    
    const newValue = target.getAttribute(attr);
    const oldValue = mutation.oldValue;
    
    // ARIA expanded (accordions, dropdowns)
    if (attr === 'aria-expanded') {
      const isExpanded = newValue === 'true';
      this.emit({
        type: 'expansion-change',
        priority: 'medium',
        element: this.getElementInfo(target),
        details: {
          description: `${this.getElementLabel(target)} ${isExpanded ? 'expanded' : 'collapsed'}`,
          oldValue: oldValue || 'false',
          newValue: newValue || 'false',
        },
        a11y: {},
      });
    }
    
    // ARIA selected (tabs, listbox items)
    if (attr === 'aria-selected' && newValue === 'true') {
      this.emit({
        type: 'selection-change',
        priority: 'medium',
        element: this.getElementInfo(target),
        details: {
          description: `Selected: ${this.getElementLabel(target)}`,
          newValue: this.getElementLabel(target),
        },
        a11y: {},
      });
    }
    
    // ARIA checked/pressed (checkboxes, toggle buttons)
    if (attr === 'aria-checked' || attr === 'aria-pressed') {
      this.emit({
        type: 'state-change',
        priority: 'low',
        element: this.getElementInfo(target),
        details: {
          description: `${this.getElementLabel(target)} ${attr.replace('aria-', '')}: ${newValue}`,
          oldValue: oldValue || undefined,
          newValue: newValue || undefined,
        },
        a11y: {},
      });
    }
    
    // ARIA invalid (form validation)
    if (attr === 'aria-invalid' && newValue === 'true') {
      const errorMessage = target.getAttribute('aria-errormessage');
      const errorEl = errorMessage ? document.getElementById(errorMessage) : null;
      
      this.emit({
        type: 'error-announce',
        priority: 'critical',
        element: this.getElementInfo(target),
        details: {
          description: `Validation error: ${this.getElementLabel(target)}`,
          announcement: errorEl?.textContent || 'Invalid input',
          politeness: 'assertive',
        },
        a11y: {},
      });
    }
    
    // ARIA live regions
    if (attr === 'aria-live') {
      if (newValue && newValue !== 'off') {
        this.liveRegions.set(target, newValue);
      } else {
        this.liveRegions.delete(target);
      }
    }
    
    // Role changes (dynamic widgets)
    if (attr === 'role') {
      const isModal = newValue === 'dialog' || newValue === 'alertdialog';
      if (isModal && !this.inModal) {
        this.inModal = true;
        this.emit({
          type: 'modal-open',
          priority: 'high',
          element: this.getElementInfo(target),
          details: {
            description: `Modal opened: ${this.getElementLabel(target)}`,
            announcement: this.getElementLabel(target),
            politeness: 'assertive',
          },
          a11y: {
            inModal: true,
          },
        });
      }
    }
    
    // Hidden state changes
    if (attr === 'aria-hidden' || attr === 'hidden') {
      const isHidden = newValue === 'true' || attr === 'hidden';
      const role = target.getAttribute('role');
      
      if (role === 'dialog' || role === 'alertdialog') {
        if (isHidden && this.inModal) {
          this.inModal = false;
          this.emit({
            type: 'modal-close',
            priority: 'high',
            element: this.getElementInfo(target),
            details: {
              description: 'Modal closed',
            },
            a11y: {
              inModal: false,
            },
          });
        }
      }
    }
  }
  
  private handleChildListMutation(mutation: MutationRecord): void {
    // Check for live region content changes
    const target = mutation.target as Element;
    
    // Check if this is a live region or inside one
    const liveRegion = this.findLiveRegionAncestor(target);
    if (liveRegion) {
      const politeness = liveRegion.getAttribute('aria-live') as A11yLiveRegionPoliteness;
      const content = liveRegion.textContent?.trim();
      
      if (content && content !== this.liveRegions.get(liveRegion)) {
        this.liveRegions.set(liveRegion, content);
        
        this.emit({
          type: 'live-region-update',
          priority: politeness === 'assertive' ? 'high' : 'medium',
          element: this.getElementInfo(liveRegion),
          details: {
            description: 'Live region updated',
            newValue: content,
            announcement: content,
            politeness,
          },
          a11y: {},
        });
      }
    }
    
    // Check for modal additions
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const role = el.getAttribute('role');
        
        if (role === 'dialog' || role === 'alertdialog') {
          this.inModal = true;
          this.emit({
            type: 'modal-open',
            priority: 'high',
            element: this.getElementInfo(el),
            details: {
              description: `Modal opened: ${this.getElementLabel(el)}`,
              announcement: this.getElementLabel(el),
              politeness: 'assertive',
            },
            a11y: {
              inModal: true,
            },
          });
        }
        
        if (role === 'menu' || role === 'listbox') {
          this.emit({
            type: 'menu-open',
            priority: 'medium',
            element: this.getElementInfo(el),
            details: {
              description: `Menu opened: ${this.getElementLabel(el)}`,
            },
            a11y: {},
          });
        }
      }
    }
    
    // Check for modal removals
    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const role = el.getAttribute('role');
        
        if (role === 'dialog' || role === 'alertdialog') {
          this.inModal = false;
          this.emit({
            type: 'modal-close',
            priority: 'high',
            element: this.getElementInfo(el),
            details: {
              description: 'Modal closed',
            },
            a11y: {
              inModal: false,
            },
          });
        }
        
        if (role === 'menu' || role === 'listbox') {
          this.emit({
            type: 'menu-close',
            priority: 'low',
            element: this.getElementInfo(el),
            details: {
              description: 'Menu closed',
            },
            a11y: {},
          });
        }
      }
    }
  }
  
  private handleCharacterDataMutation(mutation: MutationRecord): void {
    const target = mutation.target as Node;
    const parent = target.parentElement;
    
    if (!parent) return;
    
    // Check if in live region
    const liveRegion = this.findLiveRegionAncestor(parent);
    if (liveRegion) {
      const content = liveRegion.textContent?.trim();
      const politeness = liveRegion.getAttribute('aria-live') as A11yLiveRegionPoliteness;
      
      if (content) {
        this.emit({
          type: 'live-region-update',
          priority: politeness === 'assertive' ? 'high' : 'medium',
          element: this.getElementInfo(liveRegion),
          details: {
            description: 'Live region content changed',
            newValue: content,
            announcement: content,
            politeness,
          },
          a11y: {},
        });
      }
    }
  }
  
  // ============ Timer Mode ============
  
  private processTimerTick(): void {
    // Flush any pending events as a batch
    if (this.currentBatch.length > 0) {
      this.flushBatch();
    }
    
    // Scan for any changes we might have missed
    this.scanForChanges();
  }
  
  private scanForChanges(): void {
    // Check for progress bars
    document.querySelectorAll('[role="progressbar"]').forEach((el) => {
      const value = el.getAttribute('aria-valuenow');
      const label = this.getElementLabel(el as Element);
      
      // Only emit if we haven't recently emitted for this element
      const key = `progress-${el.id || label}`;
      if (this.shouldEmitEvent(key)) {
        this.emit({
          type: 'progress-update',
          priority: 'low',
          element: this.getElementInfo(el as Element),
          details: {
            description: `${label}: ${value}%`,
            newValue: value || undefined,
          },
          a11y: {},
          batch: {
            canBatch: true,
            batchKey: key,
          },
        });
      }
    });
  }
  
  private shouldEmitEvent(_key: string): boolean {
    // Rate limiting
    const now = Date.now();
    
    // Reset counter every second
    if (now - this.lastEventCountReset > 1000) {
      this.eventCount = 0;
      this.lastEventCountReset = now;
    }
    
    // Check rate limit
    if (this.eventCount >= this.config.maxEventsPerSecond) {
      return false;
    }
    
    // Check throttle
    if (now - this.lastEventTime < this.config.throttleMs) {
      return false;
    }
    
    return true;
  }
  
  // ============ Event Emission ============
  
  private emit(partial: Partial<A11yEvent> & { type: A11yEventType; details: A11yEvent['details']; a11y: A11yEvent['a11y'] }): void {
    // Check if event type is enabled
    if (!this.config.enabledEventTypes.includes(partial.type)) {
      return;
    }
    
    const priority = partial.priority || EVENT_PRIORITY_MAP[partial.type];
    
    // Check priority filter
    if (PRIORITY_ORDER[priority] > PRIORITY_ORDER[this.config.minPriority]) {
      return;
    }
    
    // Rate limiting
    if (!this.shouldEmitEvent(partial.type)) {
      return;
    }
    
    this.eventCount++;
    this.lastEventTime = Date.now();
    
    const event: A11yEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: partial.type,
      priority,
      element: partial.element,
      details: partial.details,
      a11y: {
        ...partial.a11y,
        inFocusTrap: this.inFocusTrap,
        inModal: this.inModal,
      },
      batch: partial.batch,
    };
    
    // Add to queue
    this.eventQueue.push(event);
    if (this.eventQueue.length > 500) {
      this.eventQueue = this.eventQueue.slice(-500);
    }
    
    // Notify immediate callbacks
    this.eventCallbacks.forEach((cb) => cb(event));
    
    // Handle batching
    if (this.config.mode === 'timer') {
      // In timer mode, batch everything
      this.currentBatch.push(event);
      
      if (this.currentBatch.length >= this.config.maxBatchSize) {
        this.flushBatch();
      }
    } else if (this.config.mode === 'event-driven') {
      // In event-driven mode, emit batch immediately for high-priority events
      if (priority === 'critical' || priority === 'high') {
        this.flushBatch();
        this.currentBatch = [event];
        this.flushBatch();
      } else {
        this.currentBatch.push(event);
        this.scheduleBatchFlush();
      }
    } else {
      // Hybrid mode
      this.currentBatch.push(event);
      
      if (priority === 'critical') {
        this.flushBatch();
      } else {
        this.scheduleBatchFlush();
      }
    }
  }
  
  private scheduleBatchFlush(): void {
    if (this.batchTimeout) return;
    
    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
      this.batchTimeout = null;
    }, this.config.batchTimeout);
  }
  
  private flushBatch(): void {
    if (this.currentBatch.length === 0) return;
    
    const batch: A11yEventBatch = {
      id: uuidv4(),
      startTime: this.currentBatch[0].timestamp,
      endTime: Date.now(),
      events: [...this.currentBatch],
      summary: this.summarizeBatch(this.currentBatch),
      priority: this.getHighestPriority(this.currentBatch),
    };
    
    this.batches.push(batch);
    if (this.batches.length > this.maxBatchHistory) {
      this.batches = this.batches.slice(-this.maxBatchHistory);
    }
    
    // Notify batch callbacks
    this.batchCallbacks.forEach((cb) => cb(batch));
    
    this.currentBatch = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
  
  private summarizeBatch(events: A11yEvent[]): string {
    const typeCounts = new Map<A11yEventType, number>();
    
    for (const event of events) {
      typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
    }
    
    const parts: string[] = [];
    for (const [type, count] of typeCounts) {
      parts.push(`${type}: ${count}`);
    }
    
    return parts.join(', ');
  }
  
  private getHighestPriority(events: A11yEvent[]): A11yEventPriority {
    let highest: A11yEventPriority = 'debug';
    
    for (const event of events) {
      if (PRIORITY_ORDER[event.priority] < PRIORITY_ORDER[highest]) {
        highest = event.priority;
      }
    }
    
    return highest;
  }
  
  // ============ Helper Methods ============
  
  private scanForLiveRegions(): void {
    document.querySelectorAll('[aria-live]').forEach((el) => {
      const politeness = el.getAttribute('aria-live');
      if (politeness && politeness !== 'off') {
        this.liveRegions.set(el, el.textContent || '');
      }
    });
  }
  
  private findLiveRegionAncestor(el: Element | null): Element | null {
    while (el) {
      const live = el.getAttribute('aria-live');
      if (live && live !== 'off') {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }
  
  private detectLandmark(el: Element): string | null {
    const landmarkRoles = ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search', 'form', 'region'];
    const landmarkElements: Record<string, string> = {
      main: 'main',
      nav: 'navigation',
      header: 'banner',
      footer: 'contentinfo',
      aside: 'complementary',
      form: 'form',
      section: 'region',
    };
    
    let current: Element | null = el;
    while (current) {
      const role = current.getAttribute('role');
      if (role && landmarkRoles.includes(role)) {
        return role;
      }
      
      const tagName = current.tagName.toLowerCase();
      if (landmarkElements[tagName]) {
        return landmarkElements[tagName];
      }
      
      current = current.parentElement;
    }
    
    return null;
  }
  
  private isInFocusTrap(el: Element): boolean {
    let current: Element | null = el;
    while (current) {
      const role = current.getAttribute('role');
      if (role === 'dialog' || role === 'alertdialog' || role === 'menu') {
        return true;
      }
      if (current.hasAttribute('data-focus-trap')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }
  
  private getNearestHeading(el: Element): string | undefined {
    // Look for heading in ancestors
    let current: Element | null = el;
    while (current) {
      const heading = current.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
      if (heading) {
        return heading.textContent?.trim();
      }
      current = current.parentElement;
    }
    return undefined;
  }
  
  private getElementInfo(el: Element | null): A11yEvent['element'] {
    if (!el) return undefined;
    
    return {
      tagName: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      ariaDescribedBy: el.getAttribute('aria-describedby') || undefined,
      id: el.id || undefined,
      className: el.className || undefined,
      textContent: el.textContent?.slice(0, 100).trim() || undefined,
      selector: this.getElementSelector(el),
    };
  }
  
  private getElementSelector(el: Element): string {
    if (el.id) return `#${el.id}`;
    
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const label = el.getAttribute('aria-label');
    
    if (role) return `${tag}[role="${role}"]`;
    if (label) return `${tag}[aria-label="${label.slice(0, 30)}"]`;
    
    return tag;
  }
  
  private getElementLabel(el: Element): string {
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby')?.split(' ').map(id => 
        document.getElementById(id)?.textContent
      ).join(' ') ||
      el.textContent?.slice(0, 50).trim() ||
      el.tagName.toLowerCase()
    );
  }
  
  private describeFocusChange(el: Element): string {
    const role = el.getAttribute('role');
    const label = this.getElementLabel(el);
    const tag = el.tagName.toLowerCase();
    
    if (role) {
      return `Focus on ${role}: ${label}`;
    }
    
    const inputType = (el as HTMLInputElement).type;
    if (tag === 'input' && inputType) {
      return `Focus on ${inputType} input: ${label}`;
    }
    
    return `Focus on ${tag}: ${label}`;
  }
  
  // ============ Public API ============
  
  getEvents(limit = 50): A11yEvent[] {
    return this.eventQueue.slice(-limit);
  }
  
  getBatches(limit = 20): A11yEventBatch[] {
    return this.batches.slice(-limit);
  }
  
  getEventsByType(type: A11yEventType, limit = 20): A11yEvent[] {
    return this.eventQueue.filter(e => e.type === type).slice(-limit);
  }
  
  onEvent(callback: (event: A11yEvent) => void): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }
  
  onBatch(callback: (batch: A11yEventBatch) => void): () => void {
    this.batchCallbacks.add(callback);
    return () => this.batchCallbacks.delete(callback);
  }
  
  // Programmatic announcements
  announce(message: string, politeness: A11yLiveRegionPoliteness = 'polite'): void {
    // Queue announcements to prevent overlap
    this.announcementQueue.push(message);
    
    this.emit({
      type: 'announcement',
      priority: politeness === 'assertive' ? 'high' : 'medium',
      details: {
        description: 'Programmatic announcement',
        announcement: message,
        politeness,
      },
      a11y: {},
    });
    
    // Also update actual live region for screen readers
    this.updateLiveRegion(message, politeness);
    
    // Remove from queue after processing
    setTimeout(() => {
      const idx = this.announcementQueue.indexOf(message);
      if (idx > -1) this.announcementQueue.splice(idx, 1);
    }, 1000);
  }
  
  private updateLiveRegion(message: string, politeness: A11yLiveRegionPoliteness): void {
    // Find or create live region
    let region = document.getElementById('atlas-live-region');
    
    if (!region) {
      region = document.createElement('div');
      region.id = 'atlas-live-region';
      region.setAttribute('aria-live', politeness);
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only'; // Visually hidden
      region.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
      document.body.appendChild(region);
    } else {
      region.setAttribute('aria-live', politeness);
    }
    
    // Clear and set message (needed for screen readers to announce)
    region.textContent = '';
    setTimeout(() => {
      region!.textContent = message;
    }, 50);
  }
  
  clearEvents(): void {
    this.eventQueue = [];
    this.currentBatch = [];
    this.batches = [];
  }
}

// ============ Singleton ============

let a11yEventsInstance: AccessibilityEventsService | null = null;

export function getA11yEvents(): AccessibilityEventsService {
  if (!a11yEventsInstance) {
    a11yEventsInstance = new AccessibilityEventsService();
  }
  return a11yEventsInstance;
}

export { AccessibilityEventsService };
