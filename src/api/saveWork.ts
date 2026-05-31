import axios from 'axios'
import { useAppStore } from '../stores/useAppStore'

export async function saveWork() {
    const state = useAppStore.getState()

    const saveData = {
        input: state.input,
        output: state.output,
        workblock: state.workblock,
        layout: state.layout,
    }

    return axios.post('/api/saveWork', saveData)
}