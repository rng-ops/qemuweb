/**
 * useTasks Hook
 * 
 * React hook for task/ticket management with real-time updates,
 * AI assistance, and integration with containers/network.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  taskStore, 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskType,
  TaskBoard,
  TaskComment,
} from '../services/taskStore';

interface UseTasksReturn {
  // Data
  tasks: Task[];
  board: TaskBoard | null;
  loading: boolean;
  error: string | null;

  // Stats
  stats: {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
  } | null;

  // Task CRUD
  createTask: (data: CreateTaskData) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  moveTask: (id: string, status: TaskStatus) => Promise<boolean>;

  // Task actions
  addComment: (taskId: string, content: string) => Promise<TaskComment | null>;
  assignTask: (taskId: string, assignee: string) => Promise<boolean>;
  linkToContainer: (taskId: string, containerId: string) => Promise<boolean>;
  linkToNetworkNode: (taskId: string, nodeId: string) => Promise<boolean>;

  // AI assistance
  generateTaskFromDescription: (description: string) => Promise<Task | null>;
  splitTask: (taskId: string) => Promise<Task[]>;
  suggestPriority: (taskId: string) => Promise<TaskPriority>;

  // Filters
  filterByStatus: (status: TaskStatus | null) => void;
  filterByAssignee: (assignee: string | null) => void;
  filterByPriority: (priority: TaskPriority | null) => void;
  searchTasks: (query: string) => Promise<Task[]>;

  // Refresh
  refresh: () => Promise<void>;
}

interface CreateTaskData {
  title: string;
  description: string;
  type?: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  assignee?: string;
  labels?: string[];
  parentId?: string;
  linkedContainerId?: string;
  linkedNetworkNodeId?: string;
  dueDate?: Date;
  storyPoints?: number;
}

export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UseTasksReturn['stats']>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [allTasks, defaultBoard, taskStats] = await Promise.all([
        taskStore.getAllTasks(),
        taskStore.getDefaultBoard(),
        taskStore.getStats(),
      ]);

      // Apply filters
      let filtered = allTasks;
      if (statusFilter) {
        filtered = filtered.filter(t => t.status === statusFilter);
      }
      if (assigneeFilter) {
        filtered = filtered.filter(t => t.assignee === assigneeFilter);
      }
      if (priorityFilter) {
        filtered = filtered.filter(t => t.priority === priorityFilter);
      }

      // Sort by priority and date
      filtered.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setTasks(filtered);
      setBoard(defaultBoard);
      setStats(taskStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, assigneeFilter, priorityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create task
  const createTask = useCallback(async (data: CreateTaskData): Promise<Task | null> => {
    try {
      const task = await taskStore.createTask({
        title: data.title,
        description: data.description,
        type: data.type || 'task',
        priority: data.priority || 'medium',
        status: data.status || 'backlog',
        assignee: data.assignee,
        reporter: 'user',
        labels: data.labels || [],
        linkedTasks: [],
        blockedBy: [],
        linkedContainerId: data.linkedContainerId,
        linkedNetworkNodeId: data.linkedNetworkNodeId,
        linkedFileIds: [],
        dueDate: data.dueDate,
        storyPoints: data.storyPoints,
        parentId: data.parentId,
      });

      await loadData();
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      return null;
    }
  }, [loadData]);

  // Update task
  const updateTask = useCallback(async (id: string, updates: Partial<Task>): Promise<Task | null> => {
    try {
      const task = await taskStore.updateTask(id, updates);
      await loadData();
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      return null;
    }
  }, [loadData]);

  // Delete task
  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    try {
      await taskStore.deleteTask(id);
      await loadData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      return false;
    }
  }, [loadData]);

  // Move task to status
  const moveTask = useCallback(async (id: string, status: TaskStatus): Promise<boolean> => {
    const result = await updateTask(id, { status });
    return result !== null;
  }, [updateTask]);

  // Add comment
  const addComment = useCallback(async (taskId: string, content: string): Promise<TaskComment | null> => {
    try {
      const comment = await taskStore.addComment(taskId, content);
      await loadData();
      return comment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
      return null;
    }
  }, [loadData]);

  // Assign task
  const assignTask = useCallback(async (taskId: string, assignee: string): Promise<boolean> => {
    const result = await updateTask(taskId, { assignee });
    return result !== null;
  }, [updateTask]);

  // Link to container
  const linkToContainer = useCallback(async (taskId: string, containerId: string): Promise<boolean> => {
    const result = await updateTask(taskId, { linkedContainerId: containerId });
    return result !== null;
  }, [updateTask]);

  // Link to network node
  const linkToNetworkNode = useCallback(async (taskId: string, nodeId: string): Promise<boolean> => {
    const result = await updateTask(taskId, { linkedNetworkNodeId: nodeId });
    return result !== null;
  }, [updateTask]);

  // AI: Generate task from description
  const generateTaskFromDescription = useCallback(async (description: string): Promise<Task | null> => {
    // Parse the description to extract task details using AI-like heuristics
    const lines = description.split('\n').filter(l => l.trim());
    const title = lines[0] || 'New Task';
    const fullDescription = lines.slice(1).join('\n') || description;

    // Detect priority from keywords
    let priority: TaskPriority = 'medium';
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('urgent') || lowerDesc.includes('critical') || lowerDesc.includes('asap')) {
      priority = 'critical';
    } else if (lowerDesc.includes('important') || lowerDesc.includes('high priority')) {
      priority = 'high';
    } else if (lowerDesc.includes('low priority') || lowerDesc.includes('nice to have')) {
      priority = 'low';
    }

    // Detect type from keywords
    let type: TaskType = 'task';
    if (lowerDesc.includes('bug') || lowerDesc.includes('fix') || lowerDesc.includes('broken')) {
      type = 'bug';
    } else if (lowerDesc.includes('feature') || lowerDesc.includes('story') || lowerDesc.includes('user wants')) {
      type = 'story';
    } else if (lowerDesc.includes('epic') || lowerDesc.includes('initiative')) {
      type = 'epic';
    }

    // Extract labels from hashtags
    const labelMatches = description.match(/#(\w+)/g);
    const labels = labelMatches ? labelMatches.map(l => l.slice(1)) : [];

    return createTask({
      title: title.slice(0, 100),
      description: fullDescription,
      type,
      priority,
      labels,
    });
  }, [createTask]);

  // AI: Split task into subtasks
  const splitTask = useCallback(async (taskId: string): Promise<Task[]> => {
    const task = await taskStore.getTask(taskId);
    if (!task) return [];

    // Simple heuristic: split by bullet points or numbered lists
    const lines = task.description.split('\n').filter(l => l.trim());
    const subtaskLines = lines.filter(l => 
      l.match(/^[-*•]\s/) || // Bullet points
      l.match(/^\d+[.)]\s/) // Numbered lists
    );

    if (subtaskLines.length < 2) {
      // Not enough content to split
      return [];
    }

    const subtasks: Task[] = [];
    for (const line of subtaskLines) {
      const title = line.replace(/^[-*•\d.)\s]+/, '').trim();
      if (title.length > 5) {
        const subtask = await createTask({
          title,
          description: `Subtask of ${task.key}: ${task.title}`,
          type: 'subtask',
          priority: task.priority,
          parentId: task.id,
          labels: task.labels,
        });
        if (subtask) subtasks.push(subtask);
      }
    }

    return subtasks;
  }, [createTask]);

  // AI: Suggest priority
  const suggestPriority = useCallback(async (taskId: string): Promise<TaskPriority> => {
    const task = await taskStore.getTask(taskId);
    if (!task) return 'medium';

    const text = `${task.title} ${task.description}`.toLowerCase();
    
    // Simple scoring based on keywords and context
    let score = 50;

    // Urgency indicators
    if (text.includes('urgent') || text.includes('asap')) score += 30;
    if (text.includes('critical') || text.includes('blocker')) score += 25;
    if (text.includes('important')) score += 15;
    if (text.includes('nice to have') || text.includes('eventually')) score -= 20;
    if (text.includes('low priority')) score -= 25;

    // Type-based adjustments
    if (task.type === 'bug') score += 10;
    if (task.type === 'epic') score += 5;

    // Due date proximity
    if (task.dueDate) {
      const daysUntilDue = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue < 1) score += 25;
      else if (daysUntilDue < 3) score += 15;
      else if (daysUntilDue < 7) score += 5;
    }

    // Blocked tasks get higher priority when unblocked
    if (task.blockedBy.length === 0 && task.status === 'blocked') {
      score += 20;
    }

    // Map score to priority
    if (score >= 75) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }, []);

  // Search
  const searchTasks = useCallback(async (query: string): Promise<Task[]> => {
    return taskStore.searchTasks(query);
  }, []);

  return {
    tasks,
    board,
    loading,
    error,
    stats,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    addComment,
    assignTask,
    linkToContainer,
    linkToNetworkNode,
    generateTaskFromDescription,
    splitTask,
    suggestPriority,
    filterByStatus: setStatusFilter,
    filterByAssignee: setAssigneeFilter,
    filterByPriority: setPriorityFilter,
    searchTasks,
    refresh: loadData,
  };
}

export default useTasks;
