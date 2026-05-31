import { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Container,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useSessionStore } from '../stores/useSessionStore'
import PasswordChangeDialog from '../components/auth/PasswordChangeDialog'

export default function LoginPage() {
    const navigate = useNavigate()
    const setUserID = useSessionStore((state) => state.setUserID)

    const [userID, setUserIDLocal] = useState('')
    const [password, setPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)

    const handleLogin = async () => {
        setErrorMessage('')

        if (!userID.trim() || !password) {
            setErrorMessage('ユーザーIDとパスワードを入力してください。')
            return
        }

        try {
            setSubmitting(true)

            const result = await login({
                username: userID,
                password,
            })

            if (result.code !== 200) {
                setErrorMessage(result.msg || 'ログインに失敗しました。')
                return
            }

            if (String(result.expire) === '1') {
                setPasswordDialogOpen(true)
                return
            }

            const newUserID = result.result || userID
            setUserID(newUserID)
            console.log('[LoginPage] before navigate', newUserID)
            navigate('/', { replace: true })
            console.log('[LoginPage] after navigate')

        } catch (error) {
            console.error('[LoginPage] login error:', error)
            setErrorMessage('ログインに失敗しました。')
        } finally {
            setSubmitting(false)
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void handleLogin()
        }
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#f6f7fb',
            }}
        >
            <Container maxWidth="sm">
                <Card
                    elevation={0}
                    sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        <Stack spacing={3}>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                ログイン
                            </Typography>

                            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

                            <TextField
                                label="ユーザーID"
                                value={userID}
                                onChange={(e) => setUserIDLocal(e.target.value)}
                                onKeyDown={handleKeyDown}
                                fullWidth
                                autoFocus
                            />

                            <TextField
                                label="パスワード"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                fullWidth
                            />

                            <Button
                                variant="contained"
                                onClick={() => void handleLogin()}
                                disabled={submitting}
                            >
                                ログイン
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Container>

            <PasswordChangeDialog
                open={passwordDialogOpen}
                userID={userID}
                onClose={() => setPasswordDialogOpen(false)}
                onSuccess={() => {
                    setPasswordDialogOpen(false)
                    setErrorMessage('パスワード変更後、再度ログインしてください。')
                }}
            />
        </Box>
    )
}