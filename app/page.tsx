'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  CheckSquare, 
  Calendar, 
  Timer, 
  Activity, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle2,
  Filter,
  TrendingUp,
  Flame,
  X,
  Bell,
  Clock,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Edit,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  status: 'todo' | 'in_progress' | 'done';
  due_at: string | null;
  created_at: string;
  subtasks: Subtask[];
}

interface Exam {
  id: string;
  title: string;
  date: string;
  type: 'СОР' | 'СОЧ' | 'Экзамен';
}

interface Habit {
  id: string;
  title: string;
  streak: number;
  completed_today: boolean;
  days: string[];
  reminder_time: string | null;
  created_at: string;
}

type TaskView = 'list' | 'kanban';
type TabType = 'tasks' | 'exams' | 'pomodoro' | 'habits' | 'calendar';

const WEEK_DAYS = [
  { id: 'mon', label: 'Пн', full: 'Понедельник' },
  { id: 'tue', label: 'Вт', full: 'Вторник' },
  { id: 'wed', label: 'Ср', full: 'Среда' },
  { id: 'thu', label: 'Чт', full: 'Четверг' },
  { id: 'fri', label: 'Пт', full: 'Пятница' },
  { id: 'sat', label: 'Сб', full: 'Суббота' },
  { id: 'sun', label: 'Вс', full: 'Воскресенье' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [taskView, setTaskView] = useState<TaskView>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);

  // State: Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskFilter, setTaskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [taskSort, setTaskSort] = useState<'date' | 'priority' | 'deadline'>('date');
  const [taskDueDate, setTaskDueDate] = useState('');

  // State: Exams
  const [exams, setExams] = useState<Exam[]>([]);
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examType, setExamType] = useState<'СОР' | 'СОЧ' | 'Экзамен'>('СОР');

  // State: Habits
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(WEEK_DAYS.map(d => d.id));
  const [habitReminderTime, setHabitReminderTime] = useState('');

  // State: Subtasks
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtask, setNewSubtask] = useState<{ [taskId: string]: string }>({});

  // State: Pomodoro
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');

  // State: Notifications
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  // Get current day of week
  const getCurrentDayId = () => {
    const day = new Date().getDay();
    const map = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
    return map[day as keyof typeof map];
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVQc');
    audio.play().catch(() => {});
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Initial Fetching
  useEffect(() => {
    fetchTasks();
    fetchExams();
    fetchHabits();
  }, []);

  // Request notification permission and check habit reminders
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Check for habit reminders every minute
    const checkReminders = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayId = getCurrentDayId();

      habits.forEach(habit => {
        if (
          habit.reminder_time === currentTime &&
          habit.days.includes(todayId) &&
          !habit.completed_today
        ) {
          sendHabitReminder(habit.title);
        }
      });
    };

    const reminderInterval = setInterval(checkReminders, 60000); // Check every minute

    return () => clearInterval(reminderInterval);
  }, [habits]);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        showNotification('success', 'Уведомления включены! ✅');
      } else if (permission === 'denied') {
        showNotification('error', 'Уведомления отключены. Включите их в настройках iOS');
      }
    } else {
      showNotification('error', 'Уведомления не поддерживаются в этом браузере');
    }
  };

  const sendHabitReminder = async (habitTitle: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        // Используем Service Worker для iOS PWA
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification('StudyTracker - Напоминание', {
            body: `Не забудьте выполнить привычку: ${habitTitle}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'habit-reminder',
            requireInteraction: true,
            data: {
              url: window.location.href
            }
          });
        } else {
          // Fallback для desktop
          new Notification('StudyTracker - Напоминание', {
            body: `Не забудьте выполнить привычку: ${habitTitle}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          });
        }
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }
  };

  // Pomodoro Logic
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      playNotificationSound();
      if (mode === 'work') {
        showNotification('success', 'Время работы вышло! Сделайте перерыв.');
        setMode('break');
        setTimeLeft(5 * 60);
      } else {
        showNotification('success', 'Перерыв окончен! Пора за работу.');
        setMode('work');
        setTimeLeft(25 * 60);
      }
      setIsRunning(false);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, timeLeft, mode]);

  // DB Methods: Tasks
  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setTasks(data);
    } catch (error) {
      showNotification('error', 'Ошибка загрузки задач');
      console.error('Error fetching tasks:', error);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      const taskData = {
        title: newTask,
        priority,
        completed: false,
        status: 'todo' as const,
        due_at: taskDueDate || null,
        subtasks: []
      };
      
      const tempId = `temp-${Date.now()}`;
      const tempTask = { ...taskData, id: tempId, created_at: new Date().toISOString() };
      setTasks([tempTask, ...tasks]);
      setNewTask('');
      setTaskDueDate('');
      setPriority('medium');

      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setTasks(prev => prev.map(t => t.id === tempId ? data[0] : t));
        showNotification('success', 'Задача добавлена');
      }
    } catch (error) {
      setTasks(tasks);
      setNewTask(newTask);
      showNotification('error', 'Ошибка добавления задачи');
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: !completed })
        .eq('id', id);
      if (error) throw error;
      setTasks(tasks.map(t => t.id === id ? { ...t, completed: !completed } : t));
    } catch (error) {
      showNotification('error', 'Ошибка обновления задачи');
      console.error('Error toggling task:', error);
    }
  };

  // Subtask functions
  const toggleSubtask = async (taskId: string, subtaskId: string, completed: boolean) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedSubtasks = task.subtasks.map(st =>
        st.id === subtaskId ? { ...st, completed: !completed } : st
      );

      const { error } = await supabase
        .from('tasks')
        .update({ subtasks: updatedSubtasks })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
    } catch (error) {
      showNotification('error', 'Ошибка обновления подзадачи');
      console.error('Error toggling subtask:', error);
    }
  };

  const addSubtask = async (taskId: string) => {
    const subtaskTitle = newSubtask[taskId];
    if (!subtaskTitle?.trim()) return;

    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const newSubtask: Subtask = {
        id: `sub-${Date.now()}`,
        title: subtaskTitle,
        completed: false
      };

      const updatedSubtasks = [...task.subtasks, newSubtask];

      const { error } = await supabase
        .from('tasks')
        .update({ subtasks: updatedSubtasks })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
      setNewSubtask(prev => ({ ...prev, [taskId]: '' }));
      showNotification('success', 'Подзадача добавлена');
    } catch (error) {
      showNotification('error', 'Ошибка добавления подзадачи');
      console.error('Error adding subtask:', error);
    }
  };

  const deleteSubtask = async (taskId: string, subtaskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);

      const { error } = await supabase
        .from('tasks')
        .update({ subtasks: updatedSubtasks })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
    } catch (error) {
      showNotification('error', 'Ошибка удаления подзадачи');
      console.error('Error deleting subtask:', error);
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getSubtaskProgress = (subtasks: Subtask[]) => {
    if (!subtasks || subtasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = subtasks.filter(st => st.completed).length;
    return {
      completed,
      total: subtasks.length,
      percentage: Math.round((completed / subtasks.length) * 100)
    };
  };

  const updateTaskStatus = async (id: string, status: 'todo' | 'in_progress' | 'done') => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      setTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
      showNotification('success', 'Статус обновлен');
    } catch (error) {
      showNotification('error', 'Ошибка обновления статуса');
      console.error('Error updating task status:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== id));
      showNotification('success', 'Задача удалена');
    } catch (error) {
      showNotification('error', 'Ошибка удаления задачи');
      console.error('Error deleting task:', error);
    }
  };

  // DB Methods: Exams
  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      if (data) setExams(data);
    } catch (error) {
      showNotification('error', 'Ошибка загрузки экзаменов');
      console.error('Error fetching exams:', error);
    }
  };

  const addExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim() || !examDate) return;
    try {
      const { data, error } = await supabase
        .from('exams')
        .insert([{ title: examTitle, date: examDate, type: examType }])
        .select();
      if (error) throw error;
      if (data) {
        setExams([...exams, ...data]);
        setExamTitle('');
        setExamDate('');
        showNotification('success', 'Экзамен добавлен');
      }
    } catch (error) {
      showNotification('error', 'Ошибка добавления экзамена');
      console.error('Error adding exam:', error);
    }
  };

  const deleteExam = async (id: string) => {
    try {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
      setExams(exams.filter(e => e.id !== id));
      showNotification('success', 'Экзамен удален');
    } catch (error) {
      showNotification('error', 'Ошибка удаления экзамена');
      console.error('Error deleting exam:', error);
    }
  };

  // DB Methods: Habits
  const fetchHabits = async () => {
    try {
      const { data, error } = await supabase.from('habits').select('*');
      if (error) throw error;
      if (data) setHabits(data);
    } catch (error) {
      showNotification('error', 'Ошибка загрузки привычек');
      console.error('Error fetching habits:', error);
    }
  };

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.trim()) return;
    try {
      const newHabitData = { 
        title: newHabit, 
        streak: 0, 
        completed_today: false,
        days: selectedDays,
        reminder_time: habitReminderTime || null
      };
      
      const tempId = `temp-${Date.now()}`;
      const tempHabit = { ...newHabitData, id: tempId, created_at: new Date().toISOString() };
      setHabits([...habits, tempHabit]);
      setNewHabit('');
      setSelectedDays(WEEK_DAYS.map(d => d.id));
      setHabitReminderTime('');

      const { data, error } = await supabase
        .from('habits')
        .insert([newHabitData])
        .select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setHabits(prev => prev.map(h => h.id === tempId ? data[0] : h));
        showNotification('success', 'Привычка добавлена');
      }
    } catch (error) {
      setHabits(habits);
      setNewHabit(newHabit);
      showNotification('error', 'Ошибка добавления привычки');
      console.error('Error adding habit:', error);
    }
  };

  const toggleHabit = async (id: string, completedToday: boolean, currentStreak: number) => {
    const newStreak = completedToday ? currentStreak - 1 : currentStreak + 1;
    try {
      const { error } = await supabase
        .from('habits')
        .update({ completed_today: !completedToday, streak: Math.max(0, newStreak) })
        .eq('id', id);
      if (error) throw error;
      setHabits(habits.map(h => h.id === id ? { ...h, completed_today: !completedToday, streak: Math.max(0, newStreak) } : h));
      if (!completedToday) {
        showNotification('success', 'Отлично! Продолжайте в том же духе! 🔥');
      }
    } catch (error) {
      showNotification('error', 'Ошибка обновления привычки');
      console.error('Error toggling habit:', error);
    }
  };

  const deleteHabit = async (id: string) => {
    try {
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;
      setHabits(habits.filter(h => h.id !== id));
      showNotification('success', 'Привычка удалена');
    } catch (error) {
      showNotification('error', 'Ошибка удаления привычки');
      console.error('Error deleting habit:', error);
    }
  };

  // Filter and Sort Tasks
  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;
    if (taskFilter !== 'all') {
      filtered = tasks.filter(t => t.priority === taskFilter);
    }
    
    if (taskSort === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (taskSort === 'deadline') {
      return filtered.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
    }
    return filtered;
  };

  // Get active habits for today
  const getActiveHabitsForToday = () => {
    const todayId = getCurrentDayId();
    return habits.filter(h => h.days && h.days.includes(todayId));
  };

  // Calculate habit progress
  const activeHabits = getActiveHabitsForToday();
  const habitProgress = activeHabits.length > 0 
    ? (activeHabits.filter(h => h.completed_today).length / activeHabits.length) * 100 
    : 0;

  // Format deadline
  const formatDeadline = (dueAt: string | null) => {
    if (!dueAt) return null;
    const due = new Date(dueAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: 'Просрочено', isOverdue: true };
    } else if (diffDays === 0) {
      const time = due.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return { text: `Сегодня в ${time}`, isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Завтра', isOverdue: false };
    } else {
      return { text: due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), isOverdue: false };
    }
  };

  // Calendar Logic
  const getCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    for (let i = 0; i < (startDay === 0 ? 6 : startDay - 1); i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dateExams = exams.filter(e => e.date === dateStr);
    const dateTasks = tasks.filter(t => t.due_at && t.due_at.startsWith(dateStr));
    return { exams: dateExams, tasks: dateTasks };
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 border-red-900/50 bg-red-950/30';
      case 'medium': return 'text-yellow-400 border-yellow-900/50 bg-yellow-950/30';
      case 'low': return 'text-green-400 border-green-900/50 bg-green-950/30';
      default: return 'text-zinc-400 border-zinc-800 bg-zinc-950/30';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return priority;
    }
  };

  const getTasksByStatus = (status: 'todo' | 'in_progress' | 'done') => {
    return getFilteredAndSortedTasks().filter(t => t.status === status);
  };

  const toggleDaySelection = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId]
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-950/80 border-green-800 text-green-100' 
            : 'bg-red-950/80 border-red-800 text-red-100'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-zinc-950/50 backdrop-blur-xl p-6 border-r border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2 tracking-tight">StudyTracker</h1>
        <p className="text-zinc-500 text-sm mb-8">Твой личный ассистент</p>
        
        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('tasks')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              activeTab === 'tasks' 
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-lg' 
                : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
            }`}
          >
            <CheckSquare size={20} />
            <span className="font-medium">Задачи</span>
          </button>
          <button 
            onClick={() => setActiveTab('exams')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              activeTab === 'exams' 
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-lg' 
                : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
            }`}
          >
            <Calendar size={20} />
            <span className="font-medium">СОР / СОЧ</span>
          </button>
          <button 
            onClick={() => setActiveTab('calendar')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              activeTab === 'calendar' 
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-lg' 
                : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
            }`}
          >
            <Calendar size={20} />
            <span className="font-medium">Календарь</span>
          </button>
          <button 
            onClick={() => setActiveTab('pomodoro')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              activeTab === 'pomodoro' 
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-lg' 
                : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
            }`}
          >
            <Timer size={20} />
            <span className="font-medium">Pomodoro</span>
          </button>
          <button 
            onClick={() => setActiveTab('habits')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              activeTab === 'habits' 
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-lg' 
                : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
            }`}
          >
            <Activity size={20} />
            <span className="font-medium">Привычки</span>
          </button>
        </nav>

        {/* Stats Widget */}
        <div className="mt-auto p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
            <TrendingUp size={16} />
            <span>Прогресс сегодня</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {Math.round(habitProgress)}%
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${habitProgress}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8 pt-safe">
        {activeTab === 'tasks' && (
          <section className="space-y-6">
            {/* Header with filters - adaptive layout */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight">Задачи</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="all">Все приоритеты</option>
                  <option value="high">Высокий</option>
                  <option value="medium">Средний</option>
                  <option value="low">Низкий</option>
                </select>
                <select
                  value={taskSort}
                  onChange={(e) => setTaskSort(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="date">По дате</option>
                  <option value="priority">По приоритету</option>
                  <option value="deadline">По дедлайну</option>
                </select>
                <div className="flex bg-slate-900 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setTaskView('list')}
                    className={`p-2 rounded-l-lg transition-colors ${taskView === 'list' ? 'bg-slate-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <List size={18} />
                  </button>
                  <button
                    onClick={() => setTaskView('kanban')}
                    className={`p-2 rounded-r-lg transition-colors ${taskView === 'kanban' ? 'bg-slate-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <LayoutGrid size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Form - grid on mobile, horizontal on desktop */}
            <form onSubmit={addTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="Новая задача..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className="sm:col-span-5 h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <input
                type="datetime-local"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="sm:col-span-3 h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="sm:col-span-2 h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
              <button 
                type="submit" 
                className="sm:col-span-2 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Добавить</span>
              </button>
            </form>

            {taskView === 'list' ? (
              <div className="grid gap-3">
                {getFilteredAndSortedTasks().map((task) => {
                  const deadline = formatDeadline(task.due_at);
                  const subtaskProgress = getSubtaskProgress(task.subtasks || []);
                  const isExpanded = expandedTasks.has(task.id);
                  
                  return (
                    <div 
                      key={task.id} 
                      className={`rounded-xl border backdrop-blur transition-all duration-200 hover:shadow-lg ${
                        task.completed 
                          ? 'bg-zinc-900/30 border-zinc-800 opacity-60' 
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <button 
                              onClick={() => toggleTask(task.id, task.completed)} 
                              className={`transition-all duration-200 ${
                                task.completed 
                                  ? 'text-emerald-400 scale-110' 
                                  : 'text-zinc-600 hover:text-zinc-400'
                              }`}
                            >
                              <CheckCircle2 size={24} />
                            </button>
                            <div className="flex-1">
                              <span className={`font-medium transition-all ${
                                task.completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                              }`}>
                                {task.title}
                              </span>
                              {deadline && (
                                <div className={`flex items-center gap-1 mt-1 text-xs ${deadline.isOverdue ? 'text-red-400' : 'text-zinc-500'}`}>
                                  <Clock size={12} />
                                  <span>{deadline.text}</span>
                                </div>
                              )}
                              {subtaskProgress.total > 0 && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                                        style={{ width: `${subtaskProgress.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-zinc-400">
                                      {subtaskProgress.completed}/{subtaskProgress.total}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {subtaskProgress.total > 0 && (
                              <button
                                onClick={() => toggleTaskExpansion(task.id)}
                                className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                              >
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            )}
                            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${getPriorityColor(task.priority)}`}>
                              {getPriorityLabel(task.priority)}
                            </span>
                            <button 
                              onClick={() => deleteTask(task.id)} 
                              className="text-zinc-600 hover:text-red-400 p-2 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Subtasks */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-zinc-800/50 pt-3">
                          <div className="space-y-2">
                            {task.subtasks?.map((subtask) => (
                              <div key={subtask.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30">
                                <button
                                  onClick={() => toggleSubtask(task.id, subtask.id, subtask.completed)}
                                  className={`transition-all ${
                                    subtask.completed ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'
                                  }`}
                                >
                                  <CheckCircle2 size={18} />
                                </button>
                                <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                                  {subtask.title}
                                </span>
                                <button
                                  onClick={() => deleteSubtask(task.id, subtask.id)}
                                  className="text-zinc-600 hover:text-red-400 p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                              <input
                                type="text"
                                placeholder="Новая подзадача..."
                                value={newSubtask[task.id] || ''}
                                onChange={(e) => setNewSubtask(prev => ({ ...prev, [task.id]: e.target.value }))}
                                className="flex-1 h-9 bg-slate-900 border border-slate-800 text-slate-100 rounded-lg px-3 py-1.5 text-sm placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addSubtask(task.id);
                                  }
                                }}
                              />
                              <button
                                onClick={() => addSubtask(task.id)}
                                className="h-9 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['todo', 'in_progress', 'done'].map((status) => (
                  <div key={status} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
                    <h3 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                      {status === 'todo' && '📝 Надо сделать'}
                      {status === 'in_progress' && '⚡ В процессе'}
                      {status === 'done' && '✅ Готово'}
                      <span className="text-zinc-500 text-sm">({getTasksByStatus(status as any).length})</span>
                    </h3>
                    <div className="space-y-3">
                      {getTasksByStatus(status as any).map((task) => {
                        const deadline = formatDeadline(task.due_at);
                        return (
                          <div 
                            key={task.id} 
                            className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm text-zinc-100 font-medium">{task.title}</p>
                                {deadline && (
                                  <div className={`flex items-center gap-1 mt-1 text-xs ${deadline.isOverdue ? 'text-red-400' : 'text-zinc-500'}`}>
                                    <Clock size={10} />
                                    <span>{deadline.text}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {status !== 'todo' && (
                                  <button
                                    onClick={() => updateTaskStatus(task.id, status === 'done' ? 'in_progress' : 'todo')}
                                    className="p-1 text-zinc-500 hover:text-zinc-300"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                )}
                                {status !== 'done' && (
                                  <button
                                    onClick={() => updateTaskStatus(task.id, status === 'todo' ? 'in_progress' : 'done')}
                                    className="p-1 text-zinc-500 hover:text-zinc-300"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'exams' && (
          <section className="space-y-6">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight">СОР / СОЧ / Экзамены</h2>
            
            <form onSubmit={addExam} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="Предмет / Тема"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                className="sm:col-span-5 h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="sm:col-span-3 h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <select 
                value={examType} 
                onChange={(e) => setExamType(e.target.value as any)} 
                className="sm:col-span-2 h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="СОР">СОР</option>
                <option value="СОЧ">СОЧ</option>
                <option value="Экзамен">Экзамен</option>
              </select>
              <button 
                type="submit" 
                className="sm:col-span-2 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
              >
                Добавить
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exams.map((exam) => (
                <div 
                  key={exam.id} 
                  className="p-5 rounded-xl border bg-zinc-900/50 backdrop-blur border-zinc-800 hover:border-zinc-700 transition-all duration-200 hover:shadow-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs px-3 py-1 rounded-full border font-medium ${
                      exam.type === 'СОР' 
                        ? 'text-blue-400 border-blue-900/50 bg-blue-950/30' 
                        : exam.type === 'СОЧ'
                        ? 'text-purple-400 border-purple-900/50 bg-purple-950/30'
                        : 'text-orange-400 border-orange-900/50 bg-orange-950/30'
                    }`}>
                      {exam.type}
                    </span>
                    <button 
                      onClick={() => deleteExam(exam.id)} 
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <h3 className="font-semibold text-lg text-zinc-100">{exam.title}</h3>
                  <p className="text-sm text-zinc-400 mt-2 flex items-center gap-2">
                    <Calendar size={16} />
                    {new Date(exam.date).toLocaleDateString('ru-RU', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'calendar' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight">Календарь</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-zinc-400 hover:text-zinc-100 hover:border-slate-700 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-zinc-100 font-medium min-w-[150px] text-center text-sm sm:text-base">
                  {selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-zinc-400 hover:text-zinc-100 hover:border-slate-700 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                  <div key={day} className="text-center text-sm text-zinc-500 font-medium py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {getCalendarDays().map((date, index) => {
                  if (!date) return <div key={index} className="p-2" />;
                  
                  const events = getEventsForDate(date);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const hasEvents = events.exams.length > 0 || events.tasks.length > 0;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setModalDate(date);
                        setCalendarModalOpen(true);
                      }}
                      className={`p-2 rounded-lg border transition-all hover:shadow-lg relative ${
                        isToday 
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100' 
                          : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-sm">{date.getDate()}</span>
                      {hasEvents && (
                        <div className="flex gap-1 mt-1 justify-center">
                          {events.exams.length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          )}
                          {events.tasks.length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar Modal */}
            {calendarModalOpen && modalDate && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-zinc-100">
                      {modalDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => setCalendarModalOpen(false)}
                      className="text-zinc-400 hover:text-zinc-100"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  {(() => {
                    const events = getEventsForDate(modalDate);
                    return (
                      <div className="space-y-4">
                        {events.exams.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Экзамены</h4>
                            <div className="space-y-2">
                              {events.exams.map(exam => (
                                <div key={exam.id} className="p-3 rounded-lg bg-red-950/20 border border-red-900/50">
                                  <span className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-400">{exam.type}</span>
                                  <p className="text-zinc-100 mt-1">{exam.title}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {events.tasks.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Задачи</h4>
                            <div className="space-y-2">
                              {events.tasks.map(task => (
                                <div key={task.id} className="p-3 rounded-lg bg-yellow-950/20 border border-yellow-900/50">
                                  <p className="text-zinc-100">{task.title}</p>
                                  <span className={`text-xs ${getPriorityColor(task.priority)}`}>{getPriorityLabel(task.priority)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {events.exams.length === 0 && events.tasks.length === 0 && (
                          <p className="text-zinc-500 text-center py-8">Нет запланированных событий</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'pomodoro' && (
          <section className="flex flex-col items-center justify-center py-12 space-y-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight">Фокус-Таймер</h2>
            
            <div className="relative">
              <div className={`w-72 h-72 rounded-full border-4 flex flex-col items-center justify-center backdrop-blur-xl transition-all duration-500 ${
                mode === 'work' 
                  ? 'border-zinc-700 bg-zinc-900/50 shadow-2xl shadow-zinc-900/50' 
                  : 'border-emerald-900/50 bg-emerald-950/30 shadow-2xl shadow-emerald-900/20'
              }`}>
                <span className="text-6xl font-mono font-bold text-zinc-100 tracking-wider">
                  {formatTime(timeLeft)}
                </span>
                <span className={`text-sm mt-3 uppercase tracking-widest font-medium ${
                  mode === 'work' ? 'text-zinc-400' : 'text-emerald-400'
                }`}>
                  {mode === 'work' ? 'Работа' : 'Перерыв'}
                </span>
              </div>
              {isRunning && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsRunning(!isRunning)} 
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 ${
                  isRunning 
                    ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' 
                    : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                }`}
              >
                {isRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
              </button>
              <button 
                onClick={() => { 
                  setIsRunning(false); 
                  setTimeLeft(25 * 60); 
                  setMode('work');
                }} 
                className="w-16 h-16 rounded-full bg-zinc-800 text-zinc-100 flex items-center justify-center hover:bg-zinc-700 transition-all duration-200 hover:scale-110"
              >
                <RotateCcw size={28} />
              </button>
            </div>

            <div className="text-center">
              <p className="text-zinc-500 text-sm">
                {mode === 'work' 
                  ? 'Сосредоточьтесь на одной задаче' 
                  : 'Отдохните и восстановите силы'}
              </p>
            </div>
          </section>
        )}

        {activeTab === 'habits' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight">Привычки</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Flame size={16} className="text-orange-400" />
                  <span>
                    {activeHabits.filter(h => h.completed_today).length} из {activeHabits.length} сегодня
                  </span>
                </div>
                {notificationPermission !== 'granted' && (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Bell size={14} />
                    <span className="hidden sm:inline">Включить уведомления</span>
                    <span className="sm:hidden">Уведомления</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notification Permission Warning */}
            {notificationPermission === 'denied' && (
              <div className="p-4 rounded-xl border border-yellow-900/50 bg-yellow-950/20 backdrop-blur">
                <div className="flex items-start gap-3">
                  <Bell size={20} className="text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-100 font-medium mb-1">
                      Уведомления отключены
                    </p>
                    <p className="text-xs text-yellow-200/70">
                      Чтобы получать напоминания о привычках, включите уведомления в настройках iOS: Настройки → Safari → Уведомления
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-zinc-400">Прогресс на сегодня</span>
                <span className="text-sm font-medium text-zinc-100">{Math.round(habitProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${habitProgress}%` }}
                />
              </div>
            </div>

            <form onSubmit={addHabit} className="space-y-4">
              <input
                type="text"
                placeholder="Новая привычка (напр. Чтение 20 минут)..."
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                className="w-full h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              
              <div>
                <p className="text-sm text-zinc-400 mb-2">Дни недели:</p>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDaySelection(day.id)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                        selectedDays.includes(day.id)
                          ? 'bg-slate-800 border-slate-700 text-zinc-100'
                          : 'bg-slate-900/30 border-slate-800 text-zinc-500 hover:border-slate-700'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-zinc-400 mb-2">Время напоминания (опционально):</p>
                <input
                  type="time"
                  value={habitReminderTime}
                  onChange={(e) => setHabitReminderTime(e.target.value)}
                  className="w-full h-11 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              
              <button 
                type="submit" 
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={18} />
                Добавить привычку
              </button>
            </form>

            <div className="grid gap-3">
              {activeHabits.map((habit) => (
                <div 
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id, habit.completed_today, habit.streak)}
                  className={`p-5 rounded-xl border backdrop-blur cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    habit.completed_today 
                      ? 'bg-emerald-950/20 border-emerald-900/50 shadow-lg shadow-emerald-900/10' 
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                        habit.completed_today 
                          ? 'border-emerald-500 bg-emerald-500/20' 
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}>
                        {habit.completed_today && <CheckCircle2 size={20} className="text-emerald-400" />}
                      </div>
                      <div>
                        <h4 className={`font-medium transition-all ${
                          habit.completed_today ? 'text-emerald-100' : 'text-zinc-100'
                        }`}>
                          {habit.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Flame size={14} className={habit.streak > 0 ? 'text-orange-400' : 'text-zinc-600'} />
                          <span className={`text-sm ${habit.streak > 0 ? 'text-orange-400 font-medium' : 'text-zinc-500'}`}>
                            {habit.streak} {habit.streak === 1 ? 'день' : habit.streak > 1 && habit.streak < 5 ? 'дня' : 'дней'}
                          </span>
                          {habit.reminder_time && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <Bell size={12} />
                              <span>{habit.reminder_time}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {habit.days?.map(dayId => {
                            const day = WEEK_DAYS.find(d => d.id === dayId);
                            return day ? (
                              <span key={dayId} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                {day.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHabit(habit.id);
                      }}
                      className="text-zinc-600 hover:text-red-400 p-2 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 flex justify-around p-3 pb-safe z-50">
        <button 
          onClick={() => setActiveTab('tasks')} 
          className={`flex flex-col items-center transition-colors ${
            activeTab === 'tasks' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          <CheckSquare size={22} />
          <span className="text-[11px] mt-1 font-medium">Задачи</span>
        </button>
        <button 
          onClick={() => setActiveTab('exams')} 
          className={`flex flex-col items-center transition-colors ${
            activeTab === 'exams' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          <Calendar size={22} />
          <span className="text-[11px] mt-1 font-medium">СОР/СОЧ</span>
        </button>
        <button 
          onClick={() => setActiveTab('calendar')} 
          className={`flex flex-col items-center transition-colors ${
            activeTab === 'calendar' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          <Calendar size={22} />
          <span className="text-[11px] mt-1 font-medium">Календарь</span>
        </button>
        <button 
          onClick={() => setActiveTab('pomodoro')} 
          className={`flex flex-col items-center transition-colors ${
            activeTab === 'pomodoro' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          <Timer size={22} />
          <span className="text-[11px] mt-1 font-medium">Таймер</span>
        </button>
        <button 
          onClick={() => setActiveTab('habits')} 
          className={`flex flex-col items-center transition-colors ${
            activeTab === 'habits' ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          <Activity size={22} />
          <span className="text-[11px] mt-1 font-medium">Привычки</span>
        </button>
      </nav>
    </div>
  );
}
