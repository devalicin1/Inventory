import { create } from 'zustand'

export interface Workspace {
  id: string
  name: string
  currency: string
  timezone: string
}

interface WorkspaceState {
  current: Workspace | null
  setCurrent: (w: Workspace | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  current: null,
  setCurrent: (w) => set({ current: w }),
}))

