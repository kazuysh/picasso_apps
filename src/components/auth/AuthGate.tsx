import { useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { sessionCheck } from '../../api/auth'
import { useSessionStore } from '../../stores/useSessionStore'
import LoginPage from '../../pages/LoginPage'

type AuthGateProps = {
    children: React.ReactNode
}
 
export default function AuthGate({ children }: AuthGateProps) {
    const userID = useSessionStore((state) => state.userID)
    const setUserID = useSessionStore((state) => state.setUserID)
    const clearSession = useSessionStore((state) => state.clearSession)

    const [checking, setChecking] = useState(true)

    useEffect(() => {

        sessionCheck()
            .then((res) => {
                const sessionUser = (res?.session || '').trim()
                if (sessionUser) {
                    setUserID(sessionUser)
                } else {
                    clearSession()
                }
            })
            .catch((err) => {
                console.log('[AuthGate] sessionCheck error =', err)
                clearSession()
            })
            .finally(() => {
                setChecking(false)
            })
    }, [setUserID, clearSession])

    if (checking) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <CircularProgress />
            </Box>
        )
    }

    if (!userID) {
        return <LoginPage />
    }

    return <>{children}</>
}