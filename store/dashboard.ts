import { create } from 'zustand';
import type { AgentData, GatewayStatus, SecurityAlert } from '@/types';

interface DashboardState {
  // Selected states
  selectedAgentId: string | null;
  selectedTab: string;
  selectedSprintId: string | null;
  selectedMemoryId: string | null;

  // Project isolation
  activeProjectId: string;

  // UI state
  commandViewMode: 'kanban' | 'list' | 'pipeline';
  sidebarCollapsed: boolean;
  logsOpen: boolean;

  // Alert badge
  unacknowledgedAlerts: number;

  // Actions
  setSelectedAgent: (id: string | null) => void;
  setSelectedTab: (tab: string) => void;
  setSelectedSprint: (id: string | null) => void;
  setSelectedMemory: (id: string | null) => void;
  setActiveProjectId: (id: string) => void;
  setCommandViewMode: (mode: 'kanban' | 'list' | 'pipeline') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLogsOpen: (open: boolean) => void;
  setUnacknowledgedAlerts: (count: number) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedAgentId: null,
  selectedTab: 'fleet',
  selectedSprintId: null,
  selectedMemoryId: null,
  activeProjectId: typeof window !== 'undefined' ? localStorage.getItem('mc-active-project') || 'default' : 'default',
  commandViewMode: 'kanban',
  sidebarCollapsed: false,
  logsOpen: false,
  unacknowledgedAlerts: 0,

  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setSelectedSprint: (id) => set({ selectedSprintId: id }),
  setSelectedMemory: (id) => set({ selectedMemoryId: id }),
  setActiveProjectId: (id) => {
    set({ activeProjectId: id });
    if (typeof window !== 'undefined') localStorage.setItem('mc-active-project', id);
  },
  setCommandViewMode: (mode) => set({ commandViewMode: mode }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setLogsOpen: (open) => set({ logsOpen: open }),
  setUnacknowledgedAlerts: (count) => set({ unacknowledgedAlerts: count }),
}));
