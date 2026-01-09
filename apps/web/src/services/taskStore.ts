/**
 * Task Store Service
 * 
 * IndexedDB-based storage for tasks/tickets with Jira-style features.
 * Tasks are stored in a dedicated object store with full CRUD support,
 * AI-assisted creation, and integration with the container system.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ============ Types ============

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'story' | 'task' | 'bug' | 'epic' | 'subtask';

export interface Task {
  id: string;
  key: string; // e.g., "BQ-123"
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  reporter: string;
  labels: string[];
  
  // Relationships
  parentId?: string; // For subtasks
  linkedTasks: string[];
  blockedBy: string[];
  
  // AI/Agent context
  aiSuggestions: AISuggestion[];
  automationRules: AutomationRule[];
  
  // Container/Instance references
  linkedContainerId?: string;
  linkedNetworkNodeId?: string;
  linkedFileIds: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  
  // Activity
  comments: TaskComment[];
  history: TaskHistoryEntry[];
  
  // Estimation
  storyPoints?: number;
  timeEstimateMinutes?: number;
  timeSpentMinutes?: number;
}

export interface TaskComment {
  id: string;
  authorId: string;
  content: string;
  createdAt: Date;
  isAiGenerated: boolean;
}

export interface TaskHistoryEntry {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: Date;
}

export interface AISuggestion {
  id: string;
  type: 'split' | 'merge' | 'prioritize' | 'assign' | 'estimate' | 'block' | 'link';
  title: string;
  description: string;
  confidence: number;
  /** Serializable action data - processed by the UI to apply changes */
  actionData?: Partial<Task>;
  dismissed: boolean;
}

export interface AutomationRule {
  id: string;
  trigger: 'status_change' | 'assignee_change' | 'comment_added' | 'linked_container_status';
  condition: Record<string, unknown>;
  action: 'move_status' | 'add_comment' | 'notify' | 'run_mcp_command';
  actionParams: Record<string, unknown>;
  enabled: boolean;
}

export interface TaskProject {
  id: string;
  key: string; // e.g., "BQ"
  name: string;
  description: string;
  defaultAssignee?: string;
  taskCounter: number;
  createdAt: Date;
}

export interface TaskBoard {
  id: string;
  projectId: string;
  name: string;
  columns: BoardColumn[];
  filters: Record<string, string[]>;
}

export interface BoardColumn {
  id: string;
  name: string;
  statuses: TaskStatus[];
  wipLimit?: number;
}

// ============ Database Schema ============

interface TaskDBSchema extends DBSchema {
  tasks: {
    key: string;
    value: Task;
    indexes: {
      'by-status': TaskStatus;
      'by-priority': TaskPriority;
      'by-assignee': string;
      'by-project': string;
      'by-parent': string;
      'by-created': Date;
      'by-updated': Date;
    };
  };
  projects: {
    key: string;
    value: TaskProject;
  };
  boards: {
    key: string;
    value: TaskBoard;
    indexes: {
      'by-project': string;
    };
  };
}

const DB_NAME = 'qemuweb-tasks';
const DB_VERSION = 1;

// ============ Store Class ============

class TaskStore {
  private db: IDBPDatabase<TaskDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.db = await openDB<TaskDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<TaskDBSchema>) {
        // Tasks store
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('by-status', 'status');
        taskStore.createIndex('by-priority', 'priority');
        taskStore.createIndex('by-assignee', 'assignee');
        taskStore.createIndex('by-project', 'key'); // Using key prefix
        taskStore.createIndex('by-parent', 'parentId');
        taskStore.createIndex('by-created', 'createdAt');
        taskStore.createIndex('by-updated', 'updatedAt');

        // Projects store
        db.createObjectStore('projects', { keyPath: 'id' });

        // Boards store
        const boardStore = db.createObjectStore('boards', { keyPath: 'id' });
        boardStore.createIndex('by-project', 'projectId');
      },
    });

    // Initialize default project if none exists
    const projects = await this.db.getAll('projects');
    if (projects.length === 0) {
      await this.createProject({
        key: 'BQ',
        name: 'BrowserQemu',
        description: 'Default project for BrowserQemu tasks',
      });
    }
  }

  // ============ Project Operations ============

  async createProject(data: Omit<TaskProject, 'id' | 'taskCounter' | 'createdAt'>): Promise<TaskProject> {
    await this.init();
    const project: TaskProject = {
      id: `project-${Date.now()}`,
      ...data,
      taskCounter: 0,
      createdAt: new Date(),
    };
    await this.db!.put('projects', project);
    return project;
  }

  async getProjects(): Promise<TaskProject[]> {
    await this.init();
    return this.db!.getAll('projects');
  }

  async getProject(id: string): Promise<TaskProject | undefined> {
    await this.init();
    return this.db!.get('projects', id);
  }

  async getProjectByKey(key: string): Promise<TaskProject | undefined> {
    await this.init();
    const projects = await this.db!.getAll('projects');
    return projects.find((p: TaskProject) => p.key === key);
  }

  // ============ Task Operations ============

  async createTask(data: Omit<Task, 'id' | 'key' | 'createdAt' | 'updatedAt' | 'history' | 'comments' | 'aiSuggestions' | 'automationRules'>): Promise<Task> {
    await this.init();
    
    // Get project and increment counter
    const projectKey = 'BQ'; // Default project
    let project = await this.getProjectByKey(projectKey);
    if (!project) {
      project = await this.createProject({
        key: projectKey,
        name: 'BrowserQemu',
        description: 'Default project',
      });
    }
    
    project.taskCounter++;
    await this.db!.put('projects', project);

    const now = new Date();
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      key: `${projectKey}-${project.taskCounter}`,
      ...data,
      comments: [],
      history: [],
      aiSuggestions: [],
      automationRules: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.db!.put('tasks', task);
    
    // Generate AI suggestions for the new task
    this.generateSuggestionsForTask(task);
    
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    await this.init();
    const task = await this.db!.get('tasks', id);
    if (!task) return null;

    // Track history
    const historyEntries: TaskHistoryEntry[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'history' && key !== 'updatedAt' && task[key as keyof Task] !== value) {
        historyEntries.push({
          id: `history-${Date.now()}`,
          field: key,
          oldValue: String(task[key as keyof Task]),
          newValue: String(value),
          changedBy: 'user',
          changedAt: new Date(),
        });
      }
    }

    const updatedTask: Task = {
      ...task,
      ...updates,
      history: [...task.history, ...historyEntries],
      updatedAt: new Date(),
    };

    await this.db!.put('tasks', updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('tasks', id);
  }

  async getTask(id: string): Promise<Task | undefined> {
    await this.init();
    return this.db!.get('tasks', id);
  }

  async getTaskByKey(key: string): Promise<Task | undefined> {
    await this.init();
    const tasks = await this.db!.getAll('tasks');
    return tasks.find((t: Task) => t.key === key);
  }

  async getAllTasks(): Promise<Task[]> {
    await this.init();
    return this.db!.getAll('tasks');
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    await this.init();
    return this.db!.getAllFromIndex('tasks', 'by-status', status);
  }

  async getTasksByAssignee(assignee: string): Promise<Task[]> {
    await this.init();
    return this.db!.getAllFromIndex('tasks', 'by-assignee', assignee);
  }

  async getSubtasks(parentId: string): Promise<Task[]> {
    await this.init();
    return this.db!.getAllFromIndex('tasks', 'by-parent', parentId);
  }

  // ============ Comment Operations ============

  async addComment(taskId: string, content: string, isAiGenerated = false): Promise<TaskComment | null> {
    await this.init();
    const task = await this.db!.get('tasks', taskId);
    if (!task) return null;

    const comment: TaskComment = {
      id: `comment-${Date.now()}`,
      authorId: isAiGenerated ? 'ai-assistant' : 'user',
      content,
      createdAt: new Date(),
      isAiGenerated,
    };

    task.comments.push(comment);
    task.updatedAt = new Date();
    await this.db!.put('tasks', task);

    return comment;
  }

  // ============ Board Operations ============

  async createBoard(data: Omit<TaskBoard, 'id'>): Promise<TaskBoard> {
    await this.init();
    const board: TaskBoard = {
      id: `board-${Date.now()}`,
      ...data,
    };
    await this.db!.put('boards', board);
    return board;
  }

  async getBoards(projectId: string): Promise<TaskBoard[]> {
    await this.init();
    return this.db!.getAllFromIndex('boards', 'by-project', projectId);
  }

  async getDefaultBoard(): Promise<TaskBoard> {
    await this.init();
    const boards = await this.db!.getAll('boards');
    if (boards.length > 0) return boards[0];

    // Create default Kanban board
    return this.createBoard({
      projectId: 'default',
      name: 'Main Board',
      columns: [
        { id: 'col-backlog', name: 'Backlog', statuses: ['backlog'] },
        { id: 'col-todo', name: 'To Do', statuses: ['todo'], wipLimit: 5 },
        { id: 'col-progress', name: 'In Progress', statuses: ['in-progress'], wipLimit: 3 },
        { id: 'col-review', name: 'Review', statuses: ['review'], wipLimit: 3 },
        { id: 'col-done', name: 'Done', statuses: ['done'] },
      ],
      filters: {},
    });
  }

  // ============ AI Suggestions ============

  private async generateSuggestionsForTask(task: Task): Promise<void> {
    const suggestions: AISuggestion[] = [];

    // Check if task title is too long (might need to be split)
    if (task.title.length > 100 || task.description.length > 1000) {
      suggestions.push({
        id: `suggestion-split-${Date.now()}`,
        type: 'split',
        title: 'Consider splitting this task',
        description: 'This task appears complex. Breaking it into subtasks may improve tracking.',
        confidence: 0.7,
        dismissed: false,
      });
    }

    // Check if task has no estimate
    if (!task.storyPoints && !task.timeEstimateMinutes) {
      suggestions.push({
        id: `suggestion-estimate-${Date.now()}`,
        type: 'estimate',
        title: 'Add estimation',
        description: 'Adding story points or time estimates helps with sprint planning.',
        confidence: 0.8,
        actionData: { storyPoints: 3 },
        dismissed: false,
      });
    }

    // Check if high priority without assignee
    if ((task.priority === 'critical' || task.priority === 'high') && !task.assignee) {
      suggestions.push({
        id: `suggestion-assign-${Date.now()}`,
        type: 'assign',
        title: 'Assign this high-priority task',
        description: 'High-priority tasks should have an assignee for accountability.',
        confidence: 0.9,
        dismissed: false,
      });
    }

    if (suggestions.length > 0) {
      task.aiSuggestions = [...task.aiSuggestions, ...suggestions];
      await this.db!.put('tasks', task);
    }
  }

  // ============ Search ============

  async searchTasks(query: string): Promise<Task[]> {
    await this.init();
    const allTasks = await this.db!.getAll('tasks');
    const lowerQuery = query.toLowerCase();
    
    return allTasks.filter((task: Task) => 
      task.title.toLowerCase().includes(lowerQuery) ||
      task.description.toLowerCase().includes(lowerQuery) ||
      task.key.toLowerCase().includes(lowerQuery) ||
      task.labels.some((l: string) => l.toLowerCase().includes(lowerQuery))
    );
  }

  // ============ Stats ============

  async getStats(): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
  }> {
    await this.init();
    const tasks = await this.db!.getAll('tasks');
    
    const byStatus: Record<TaskStatus, number> = {
      backlog: 0, todo: 0, 'in-progress': 0, review: 0, done: 0, blocked: 0
    };
    const byPriority: Record<TaskPriority, number> = {
      critical: 0, high: 0, medium: 0, low: 0
    };

    for (const task of tasks) {
      byStatus[task.status]++;
      byPriority[task.priority]++;
    }

    return { total: tasks.length, byStatus, byPriority };
  }
}

// Singleton instance
export const taskStore = new TaskStore();

// React hook helper
export function useTaskStore() {
  return taskStore;
}
