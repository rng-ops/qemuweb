/**
 * Tasks View Component
 * 
 * Jira-style Kanban board for task management with:
 * - Drag-and-drop between columns
 * - AI-assisted task creation
 * - Container/Network integration
 * - Real-time updates
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import type { Task, TaskStatus, TaskPriority, TaskType } from '../../services/taskStore';

interface TasksViewProps {
  onTaskSelect?: (task: Task) => void;
  onLinkContainer?: (taskId: string) => void;
  onLinkNetworkNode?: (taskId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  onTaskSelect,
  onLinkContainer,
  onLinkNetworkNode,
}) => {
  const {
    tasks,
    board,
    loading,
    stats,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    addComment,
    generateTaskFromDescription,
    refresh,
  } = useTasks();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Group tasks by status for Kanban columns
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      'in-progress': [],
      review: [],
      done: [],
      blocked: [],
    };

    for (const task of tasks) {
      grouped[task.status].push(task);
    }

    return grouped;
  }, [tasks]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      await moveTask(draggedTaskId, targetStatus);
      setDraggedTaskId(null);
    }
  }, [draggedTaskId, moveTask]);

  // AI task creation
  const handleAICreate = useCallback(async () => {
    if (!aiInput.trim()) return;
    setIsGenerating(true);
    try {
      const task = await generateTaskFromDescription(aiInput);
      if (task) {
        setAiInput('');
        setSelectedTask(task);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [aiInput, generateTaskFromDescription]);

  // Quick create task
  const handleQuickCreate = useCallback(async (status: TaskStatus) => {
    const title = prompt('Task title:');
    if (title) {
      await createTask({
        title,
        description: '',
        status,
        priority: 'medium',
      });
    }
  }, [createTask]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
          <span className="text-sm text-gray-400">Loading tasks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <TaskIcon className="w-5 h-5 text-indigo-400" />
            Tasks
          </h2>
          {stats && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{stats.total} total</span>
              <span className="text-yellow-400">{stats.byStatus['in-progress']} in progress</span>
              <span className="text-green-400">{stats.byStatus.done} done</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            Create Task
          </button>
          <button
            onClick={refresh}
            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Quick Create */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-850">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-purple-400" />
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAICreate()}
            placeholder="Describe a task and AI will create it... (e.g., 'Fix the login bug, urgent')"
            className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleAICreate}
            disabled={isGenerating || !aiInput.trim()}
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50"
          >
            {isGenerating ? 'Creating...' : 'Create with AI'}
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 min-w-max h-full">
          {board?.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              name={column.name}
              statuses={column.statuses}
              tasks={column.statuses.flatMap(s => tasksByStatus[s] || [])}
              wipLimit={column.wipLimit}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.statuses[0])}
              onDragStart={handleDragStart}
              onTaskClick={(task) => {
                setSelectedTask(task);
                onTaskSelect?.(task);
              }}
              onQuickCreate={() => handleQuickCreate(column.statuses[0])}
              draggedTaskId={draggedTaskId}
            />
          ))}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onAddComment={addComment}
          onLinkContainer={onLinkContainer}
          onLinkNetworkNode={onLinkNetworkNode}
        />
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createTask}
        />
      )}
    </div>
  );
};

// Kanban Column Component
interface KanbanColumnProps {
  name: string;
  statuses: TaskStatus[];
  tasks: Task[];
  wipLimit?: number;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onQuickCreate: () => void;
  draggedTaskId: string | null;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  name,
  tasks,
  wipLimit,
  onDragOver,
  onDrop,
  onDragStart,
  onTaskClick,
  onQuickCreate,
  draggedTaskId,
}) => {
  const isOverLimit = wipLimit && tasks.length > wipLimit;

  return (
    <div
      className={`flex flex-col w-72 bg-gray-800 rounded-lg ${
        draggedTaskId ? 'ring-2 ring-indigo-500/50' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${
        isOverLimit ? 'border-red-500 bg-red-900/20' : 'border-gray-700'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">{name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isOverLimit ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'
          }`}>
            {tasks.length}{wipLimit ? `/${wipLimit}` : ''}
          </span>
        </div>
        <button
          onClick={onQuickCreate}
          className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDragStart={onDragStart}
            onClick={() => onTaskClick(task)}
            isDragging={task.id === draggedTaskId}
          />
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
};

// Task Card Component
interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: () => void;
  isDragging: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onDragStart, onClick, isDragging }) => {
  const priorityColors: Record<TaskPriority, string> = {
    critical: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-blue-500',
  };

  const typeIcons: Record<TaskType, React.ReactNode> = {
    story: <StoryIcon className="w-4 h-4 text-green-400" />,
    task: <TaskTypeIcon className="w-4 h-4 text-blue-400" />,
    bug: <BugIcon className="w-4 h-4 text-red-400" />,
    epic: <EpicIcon className="w-4 h-4 text-purple-400" />,
    subtask: <SubtaskIcon className="w-4 h-4 text-gray-400" />,
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className={`p-3 bg-gray-900 rounded border-l-4 ${priorityColors[task.priority]} cursor-pointer hover:bg-gray-850 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {typeIcons[task.type]}
          <span className="text-xs text-gray-500">{task.key}</span>
        </div>
        {task.storyPoints && (
          <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
            {task.storyPoints} SP
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm text-gray-200 line-clamp-2">{task.title}</p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          {task.labels.slice(0, 2).map((label) => (
            <span
              key={label}
              className="text-xs px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 rounded"
            >
              {label}
            </span>
          ))}
        </div>
        {task.assignee && (
          <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs text-white">
            {task.assignee.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* AI Suggestions indicator */}
      {task.aiSuggestions.filter(s => !s.dismissed).length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-purple-400">
          <SparklesIcon className="w-3 h-3" />
          {task.aiSuggestions.filter(s => !s.dismissed).length} AI suggestions
        </div>
      )}

      {/* Links indicator */}
      {(task.linkedContainerId || task.linkedNetworkNodeId) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          {task.linkedContainerId && (
            <span className="flex items-center gap-0.5">
              <ContainerIcon className="w-3 h-3" />
              Linked
            </span>
          )}
          {task.linkedNetworkNodeId && (
            <span className="flex items-center gap-0.5">
              <NetworkIcon className="w-3 h-3" />
              Linked
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Task Detail Modal
interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<Task | null>;
  onDelete: (id: string) => Promise<boolean>;
  onAddComment: (taskId: string, content: string) => Promise<unknown>;
  onLinkContainer?: (taskId: string) => void;
  onLinkNetworkNode?: (taskId: string) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  onUpdate,
  onDelete,
  onAddComment,
  onLinkContainer,
  onLinkNetworkNode,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description);

  const handleSave = async () => {
    await onUpdate(task.id, {
      title: editedTitle,
      description: editedDescription,
    });
    setIsEditing(false);
  };

  const handleAddComment = async () => {
    if (commentText.trim()) {
      await onAddComment(task.id, commentText);
      setCommentText('');
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete task ${task.key}?`)) {
      await onDelete(task.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{task.key}</span>
            <PriorityBadge priority={task.priority} />
            <TypeBadge type={task.type} />
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full text-lg font-medium bg-gray-700 text-white px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <h2 className="text-lg font-medium text-white">{task.title}</h2>
          )}

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            {isEditing ? (
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full h-32 bg-gray-700 text-gray-200 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {task.description || 'No description'}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select
                value={task.status}
                onChange={(e) => onUpdate(task.id, { status: e.target.value as TaskStatus })}
                className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priority</label>
              <select
                value={task.priority}
                onChange={(e) => onUpdate(task.id, { priority: e.target.value as TaskPriority })}
                className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assignee</label>
              <input
                type="text"
                value={task.assignee || ''}
                onChange={(e) => onUpdate(task.id, { assignee: e.target.value })}
                placeholder="Unassigned"
                className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Story Points</label>
              <input
                type="number"
                value={task.storyPoints || ''}
                onChange={(e) => onUpdate(task.id, { storyPoints: parseInt(e.target.value) || undefined })}
                placeholder="0"
                className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm"
              />
            </div>
          </div>

          {/* Links */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Links</label>
            <div className="flex gap-2">
              <button
                onClick={() => onLinkContainer?.(task.id)}
                className={`px-3 py-1.5 text-xs rounded flex items-center gap-1 ${
                  task.linkedContainerId
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <ContainerIcon className="w-3 h-3" />
                {task.linkedContainerId ? 'Linked to Container' : 'Link Container'}
              </button>
              <button
                onClick={() => onLinkNetworkNode?.(task.id)}
                className={`px-3 py-1.5 text-xs rounded flex items-center gap-1 ${
                  task.linkedNetworkNodeId
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <NetworkIcon className="w-3 h-3" />
                {task.linkedNetworkNodeId ? 'Linked to Node' : 'Link Network Node'}
              </button>
            </div>
          </div>

          {/* AI Suggestions */}
          {task.aiSuggestions.filter(s => !s.dismissed).length > 0 && (
            <div>
              <label className="text-xs text-purple-400 mb-2 block flex items-center gap-1">
                <SparklesIcon className="w-3 h-3" />
                AI Suggestions
              </label>
              <div className="space-y-2">
                {task.aiSuggestions.filter(s => !s.dismissed).map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-2 bg-purple-900/20 border border-purple-700/50 rounded text-sm"
                  >
                    <div className="font-medium text-purple-300">{suggestion.title}</div>
                    <p className="text-xs text-gray-400 mt-1">{suggestion.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Comments ({task.comments.length})</label>
            <div className="space-y-2 mb-3">
              {task.comments.map((comment) => (
                <div key={comment.id} className="p-2 bg-gray-700 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-300">
                      {comment.isAiGenerated ? '🤖 AI Assistant' : comment.authorId}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200">{comment.content}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-700 text-gray-200 px-3 py-1.5 rounded text-sm"
              />
              <button
                onClick={handleAddComment}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30 rounded"
          >
            Delete Task
          </button>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded"
                >
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Create Task Modal
interface CreateTaskModalProps {
  onClose: () => void;
  onCreate: (data: {
    title: string;
    description: string;
    type?: TaskType;
    priority?: TaskPriority;
    status?: TaskStatus;
    labels?: string[];
  }) => Promise<Task | null>;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      await onCreate({ title, description, type, priority });
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-800 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">Create Task</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              className="w-full h-24 bg-gray-700 text-gray-200 px-3 py-2 rounded resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full bg-gray-700 text-gray-200 px-2 py-1.5 rounded"
              >
                <option value="task">Task</option>
                <option value="story">Story</option>
                <option value="bug">Bug</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-gray-700 text-gray-200 px-2 py-1.5 rounded"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Badge Components
const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const colors: Record<TaskPriority, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-600 text-white',
    medium: 'bg-yellow-600 text-black',
    low: 'bg-blue-600 text-white',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[priority]}`}>
      {priority}
    </span>
  );
};

const TypeBadge: React.FC<{ type: TaskType }> = ({ type }) => {
  const colors: Record<TaskType, string> = {
    story: 'bg-green-900/50 text-green-400',
    task: 'bg-blue-900/50 text-blue-400',
    bug: 'bg-red-900/50 text-red-400',
    epic: 'bg-purple-900/50 text-purple-400',
    subtask: 'bg-gray-700 text-gray-400',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[type]}`}>
      {type}
    </span>
  );
};

// Icons
const TaskIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const StoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const TaskTypeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const BugIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const EpicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const SubtaskIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
  </svg>
);

const ContainerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const NetworkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

export default TasksView;
