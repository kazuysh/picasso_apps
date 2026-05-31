import { create } from 'zustand'
import axios from 'axios'

type ConfigState = {
    config: Record<string, any>
    loading: boolean
    fetchData: () => Promise<void>
}

export const useConfigStore = create<ConfigState>((set) => ({
    config: {},
    loading: false,

    fetchData: async () => {
        set({ loading: true })

        try {
            const res = await axios.get('/api/getConfig')
            const json = res.data
            console.log('getConfig:', json)

            set({
                config: json || {},
                loading: false,
            })
        } catch (err) {
            console.error('読み込みエラー:', err)
            set({ loading: false })
        }
    },
}))