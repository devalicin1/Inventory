import { create } from 'zustand'

type Role = 'owner' | 'admin' | 'manager' | 'staff' | 'operator'

export interface UserSession {
  userId: string | null
  email: string | null
  workspaceId: string | null
  roles: Role[]
}

interface SessionState extends UserSession {
  setSession: (s: Partial<UserSession>) => void
  clear: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  email: null,
  workspaceId: null,
  roles: [],
  setSession: (s) => set((prev) => ({ ...prev, ...s })),
  clear: () => set({ userId: null, email: null, workspaceId: null, roles: [] }),
}))

