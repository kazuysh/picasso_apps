import { Box } from '@mui/material'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AuthGate from '../components/auth/AuthGate'
import AppHeader from '../components/AppHeader'
import RouteChangeSync from '../components/RouteChangeSync'
import ProjectListPage from '../pages/ProjectListPage'
import GenerationRunnerPage from '../pages/GenerationRunnerPage'
import ProjectDetailPage from '../pages/ProjectDetailPage'

export default function AppRouter() {
    return (
        <BrowserRouter basename="/react">
            <AuthGate>
                <AppHeader />
                <RouteChangeSync />

                <Box sx={{ flex: 1 }}>
                    <Routes>
                        <Route path="/" element={<ProjectListPage />} />
                        <Route path="/GenerationRunnerPage" element={<GenerationRunnerPage />} />
                        <Route path="/project-detail" element={<ProjectDetailPage />} />
                    </Routes>
                </Box>
            </AuthGate>
        </BrowserRouter>
    )
}
