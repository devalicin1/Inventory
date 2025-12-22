import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UIState {
    isSearchOpen: boolean
    openSearch: () => void
    closeSearch: () => void
    toggleSearch: () => void
    isSidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isSearchOpen: false,
            openSearch: () => set({ isSearchOpen: true }),
            closeSearch: () => set({ isSearchOpen: false }),
            toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
            isSidebarCollapsed: false,
            toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
            setSidebarCollapsed: (collapsed: boolean) => set({ isSidebarCollapsed: collapsed }),
        }),
        {
            name: 'ui-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
