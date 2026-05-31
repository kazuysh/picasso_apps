import { useEffect, useState } from 'react'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    TextField,
} from '@mui/material'

type BasicInfoItem = {
    powercompany?: string[]
    major_specification?: string[]
    minor_specification?: Record<string, string[]>
    category?: string[]
    category2?: Record<string, string[]>
    category3?: string[]
}

type BasicInfoDialogProps = {
    open: boolean
    initialData: Record<string, any>
    item?: BasicInfoItem
    onClose: () => void
    onSave: (data: Record<string, any>) => void
}

export default function BasicInfoDialog({
    open,
    initialData,
    item,
    onClose,
    onSave,
}: BasicInfoDialogProps) {
    const [form, setForm] = useState<Record<string, any>>({})

    useEffect(() => {
        setForm({
            subjectName: '',
            drawingNoTemp: '',
            bordName: '',
            powercompany: '',
            frequency: '',
            major_specification: '',
            minor_specification2: '',
            category: '',
            category2: '',
            category3: '',
            ...initialData,
        })
    }, [initialData, open])

    const updateField = (key: string, value: any) => {
        setForm((prev) => {
            const next = { ...prev, [key]: value }

            if (key === 'major_specification') {
                const list = item?.minor_specification?.[value] || []
                if (!list.includes(next.minor_specification2)) {
                    next.minor_specification2 = ''
                }
            }

            if (key === 'category') {
                const list = item?.category2?.[value] || []
                if (!list.includes(next.category2)) {
                    next.category2 = ''
                }
            }

            return next
        })
    }

    const handleSave = () => {
        if (!String(form.subjectName || '').trim()) {
            alert('件名／工事名は必須です。')
            return
        }
        onSave(form)
    }

    const minorSpecificationList =
        item?.minor_specification?.[form.major_specification] || []

    const category2List = item?.category2?.[form.category] || []

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>基本情報編集</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <TextField
                        label="件名／工事名"
                        value={form.subjectName || ''}
                        onChange={(e) => updateField('subjectName', e.target.value)}
                        placeholder="〇〇ビル建替工事"
                        inputProps={{ maxLength: 20 }}
                        helperText={`${String(form.subjectName || '').length}/20`}
                        fullWidth
                        required
                    />

                    <TextField
                        label="図面番号"
                        value={form.drawingNoTemp || ''}
                        onChange={(e) => updateField('drawingNoTemp', e.target.value)}
                        placeholder="ZA-Z9999-99-C99"
                        inputProps={{ maxLength: 16 }}
                        helperText={`${String(form.drawingNoTemp || '').length}/16`}
                        fullWidth
                    />

                    <TextField
                        label="盤名称"
                        value={form.bordName || ''}
                        onChange={(e) => updateField('bordName', e.target.value)}
                        placeholder="盤名称"
                        inputProps={{ maxLength: 16 }}
                        helperText={`${String(form.bordName || '').length}/16`}
                        fullWidth
                    />

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl fullWidth>
                                <InputLabel>地域</InputLabel>
                                <Select
                                    value={form.powercompany || ''}
                                    label="地域"
                                    onChange={(e) => updateField('powercompany', e.target.value)}
                                >
                                    {(item?.powercompany || []).map((v) => (
                                        <MenuItem key={v} value={v}>
                                            {v}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl>
                                <FormLabel>周波数</FormLabel>
                                <RadioGroup
                                    row
                                    value={String(form.frequency || '')}
                                    onChange={(e) => updateField('frequency', e.target.value)}
                                >
                                    <FormControlLabel value="50" control={<Radio />} label="50HZ" />
                                    <FormControlLabel value="60" control={<Radio />} label="60HZ" />
                                </RadioGroup>
                            </FormControl>
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl fullWidth>
                                <InputLabel>設備仕様</InputLabel>
                                <Select
                                    value={form.major_specification || ''}
                                    label="設備仕様"
                                    onChange={(e) =>
                                        updateField('major_specification', e.target.value)
                                    }
                                >
                                    {(item?.major_specification || []).map((v) => (
                                        <MenuItem key={v} value={v}>
                                            {v}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl fullWidth>
                                <InputLabel>設備仕様(追加)</InputLabel>
                                <Select
                                    value={form.minor_specification2 || ''}
                                    label="設備仕様(追加)"
                                    onChange={(e) =>
                                        updateField('minor_specification2', e.target.value)
                                    }
                                >
                                    <MenuItem value="">
                                        <em>未選択</em>
                                    </MenuItem>
                                    {minorSpecificationList.map((v) => (
                                        <MenuItem key={v} value={v}>
                                            {v}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <FormControl fullWidth>
                                <InputLabel>カテゴリー1</InputLabel>
                                <Select
                                    value={form.category || ''}
                                    label="カテゴリー1"
                                    onChange={(e) => updateField('category', e.target.value)}
                                >
                                    {(item?.category || []).map((v) => (
                                        <MenuItem key={v} value={v}>
                                            {v}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
                            <FormControl fullWidth>
                                <InputLabel>カテゴリー2</InputLabel>
                                <Select
                                    value={form.category2 || ''}
                                    label="カテゴリー2"
                                    onChange={(e) => updateField('category2', e.target.value)}
                                >
                                    <MenuItem value="">
                                        <em>未選択</em>
                                    </MenuItem>
                                    {category2List.map((v) => (
                                        <MenuItem key={v} value={v}>
                                            {v}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
                            <FormControl fullWidth>
                                <InputLabel>カテゴリー3</InputLabel>
                                <Select
                                    value={form.category3 || ''}
                                    label="カテゴリー3"
                                    onChange={(e) => updateField('category3', e.target.value)}
                                >
                                    {(item?.category3 || []).map((v) => (
                                        <MenuItem key={v} value={v}>
                                            {v}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>キャンセル</Button>
                <Button variant="contained" onClick={handleSave}>
                    保存
                </Button>
            </DialogActions>
        </Dialog>
    )
}