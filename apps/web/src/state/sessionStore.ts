import { create } from 'zustand'

type Role = 'owner' | 'admin' | 'manager' | 'staff' | 'operator'

export interface UserWorkspace {
  workspaceId: string
  name: string
  role: Role
}

export interface UserSession {
  userId: string | null
  email: string | null
  displayName: string | null
  workspaceId: string | null
  roles: Role[]
  userWorkspaces: UserWorkspace[]
  isSuperAdmin: boolean
}

interface SessionState extends UserSession {
  setSession: (s: Partial<UserSession>) => void
  clear: () => void
  switchWorkspace: (workspaceId: string) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  userId: null,
  email: null,
  displayName: null,
  workspaceId: null,
  roles: [],
  userWorkspaces: [],
  isSuperAdmin: false,
  setSession: (s) => set((prev) => ({ ...prev, ...s })),
  clear: () => set({ 
    userId: null, 
    email: null, 
    displayName: null,
    workspaceId: null, 
    roles: [], 
    userWorkspaces: [],
    isSuperAdmin: false
  }),
  switchWorkspace: (workspaceId: string) => {
    const { userWorkspaces } = get()
    const workspace = userWorkspaces.find(ws => ws.workspaceId === workspaceId)
    if (workspace) {
      set({ 
        workspaceId, 
        roles: [workspace.role] 
      })
    }
  },
}))

