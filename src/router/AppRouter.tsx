import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AuthGate from '../components/auth/AuthGate'
import RouteChangeSync from '../components/RouteChangeSync'
import ProjectListPage from '../pages/ProjectListPage'
import GenerationRunnerPage from '../pages/GenerationRunnerPage'
import ProjectDetailPage from '../pages/ProjectDetailPage'

export default function AppRouter() {
    return (
        <BrowserRouter basename="/react">
            <AuthGate>
                <RouteChangeSync />

                <Routes>
                    <Route path="/" element={<ProjectListPage />} />
                    <Route path="/GenerationRunnerPage" element={<GenerationRunnerPage />} />
                    <Route path="/project-detail" element={<ProjectDetailPage />} />
                </Routes>
            </AuthGate>
        </BrowserRouter>
    )
}