import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SessionState = {
    userID: string
}

type SessionActions = {
    setUserID: (userID: string) => void
    clearSession: () => void
}

export const useSessionStore = create<SessionState & SessionActions>()(
    persist(
        (set) => ({
            userID: '',
            setUserID: (userID: string) => set({ userID }),
            clearSession: () => set({ userID: '' }),
        }),
        {
            name: 'session',
        }
    )
)