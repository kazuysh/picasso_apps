import { useState } from 'react'
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
} from '@mui/material'
import { changePassword } from '../../api/auth'

const MIN_PASSWORD_LENGTH = 8
const ALPHANUMERIC_PATTERN = /^[a-zA-Z0-9]+$/
const LETTER_AND_NUMBER_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)/

type PasswordChangeDialogProps = {
    open: boolean
    userID: string
    onClose: () => void
    onSuccess?: () => void
}

export default function PasswordChangeDialog({
    open,
    userID,
    onClose,
    onSuccess,
}: PasswordChangeDialogProps) {
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const resetForm = () => {
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setErrorMessage('')
        setSuccessMessage('')
    }

    const handleClose = () => {
        if (submitting) return
        resetForm()
        onClose()
    }

    const handleSubmit = async () => {
        setErrorMessage('')
        setSuccessMessage('')

        if (!userID.trim()) {
            setErrorMessage('ユーザーIDがありません。')
            return
        }

        if (!oldPassword || !newPassword || !confirmPassword) {
            setErrorMessage('すべて入力してください。')
            return
        }

        if (oldPassword === newPassword) {
            setErrorMessage('同じパスワードを使用しないでください。')
            return
        }

        if (oldPassword.length < MIN_PASSWORD_LENGTH) {
            setErrorMessage('現在のパスワードは8文字以上で入力してください。')
            return
        }

        if (!ALPHANUMERIC_PATTERN.test(oldPassword)) {
            setErrorMessage('現在のパスワードは半角英数字のみで入力してください。')
            return
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setErrorMessage('新しいパスワードは8文字以上で入力してください。')
            return
        }

        if (!ALPHANUMERIC_PATTERN.test(newPassword)) {
            setErrorMessage('新しいパスワードは半角英数字のみで入力してください。')
            return
        }

        if (!LETTER_AND_NUMBER_PATTERN.test(newPassword)) {
            setErrorMessage('新しいパスワードには英字と数字の両方を含めてください。')
            return
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage('新しいパスワードが一致しません。')
            return
        }

        try {
            setSubmitting(true)

            const result = await changePassword({
                username: userID,
                password: oldPassword,
                newpassword: newPassword,
            })

            if (result.modified_count === 1) {
                setSuccessMessage('パスワードを変更しました。')
                resetForm()
                onSuccess?.()
                return
            }

            setErrorMessage('旧パスワードが間違っています。')
        } catch (error) {
            console.error('[PasswordChangeDialog] change password error:', error)
            setErrorMessage('パスワード変更に失敗しました。')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>パスワード変更</DialogTitle>

            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                    {successMessage && <Alert severity="success">{successMessage}</Alert>}

                    <TextField
                        label="ユーザーID"
                        value={userID}
                        fullWidth
                        disabled
                    />

                    <TextField
                        label="現在のパスワード"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        fullWidth
                    />

                    <TextField
                        label="新しいパスワード"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        fullWidth
                    />

                    <TextField
                        label="新しいパスワード（確認）"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        fullWidth
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} disabled={submitting}>
                    閉じる
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                >
                    変更
                </Button>
            </DialogActions>
        </Dialog>
    )
}
