import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from '@mui/material'
import ColorPickerDialog from './ColorPickerDialog'

type CabinetInfoItem = {
    format?: string[]
    format2?: string[]
    format3?: string[]
    material?: string[]
    structure?: string[]
    input_wire?: string[]
    output_wire?: string[]
    colors?: Record<string, { NAME: string; RGB: string }>
    selectData?: Record<string, any>
}

type Props = {
    open: boolean
    initialData: Record<string, any>
    item?: CabinetInfoItem
    onClose: () => void
    onSave: (data: Record<string, any>) => void
}

export default function CabinetInfoDialog({
    open,
    initialData,
    item = {},
    onClose,
    onSave,
}: Props) {
    const [form, setForm] = useState<Record<string, any>>({})
    const [hasCombination, setHasCombination] = useState(true)

    useEffect(() => {
        setForm({
            format: '',
            format2: '',
            format3: '',
            material: '',
            structure: '',
            outer_color: '',
            boxwidth: '',
            boxheight: '',
            boxdepth: '',
            support_height: '',
            input_wire: '',
            output_wire: '',
            ...initialData,
        })
    }, [initialData, open])

    const colorNames = useMemo(() => {
        return Object.keys(item.colors || {}).map((key) => item.colors?.[key]?.NAME).filter(Boolean)
    }, [item.colors])

    const getLinkedData = (nextForm: Record<string, any>) => {
        const selectData = item.selectData

        if (!selectData) {
            setHasCombination(false)
            return null
        }

        const f1 = nextForm.format
        const f2 = nextForm.format2
        const f3 = nextForm.format3

        if (!f1 || !f2) {
            setHasCombination(false)
            return null
        }

        const lv1 = selectData[f1]
        if (!lv1) {
            setHasCombination(false)
            return null
        }

        const lv2 = lv1[f2]
        if (!lv2) {
            setHasCombination(false)
            return null
        }

        if (f3 && lv2[f3]) {
            setHasCombination(true)
            return lv2[f3]
        }

        const fallback = lv2.default || lv2[''] || null

        if (fallback) {
            setHasCombination(true)
            return fallback
        }

        setHasCombination(false)
        return null
    }

    const applyLinkedData = (nextForm: Record<string, any>) => {
        const linked = getLinkedData(nextForm)

        console.log('CabinetInfo applyLinkedData linked =', linked)

        if (!linked) {
            console.log('CabinetInfo applyLinkedData: linked がないため反映しない')
            return nextForm
        }

        const updated = { ...nextForm }

        if (linked.material !== undefined) {
            updated.material = linked.material
        }

        if (linked.structure !== undefined) {
            updated.structure = linked.structure
        } else if (linked.strustructure !== undefined) {
            updated.structure = linked.strustructure
        }

        if (linked.boxdepth !== undefined && linked.boxdepth !== null && linked.boxdepth !== '') {
            updated.boxdepth = Number(linked.boxdepth)
        }

        if (
            linked.support_height !== undefined &&
            linked.support_height !== null &&
            linked.support_height !== ''
        ) {
            updated.support_height = Number(linked.support_height)
        } else if (
            linked.supportheight !== undefined &&
            linked.supportheight !== null &&
            linked.supportheight !== ''
        ) {
            updated.support_height = Number(linked.supportheight)
        }

        console.log('CabinetInfo applyLinkedData result =', updated)

        return updated
    }

    useEffect(() => {
        if (!open) return
        setForm((prev) => applyLinkedData(prev))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.selectData, open])

    const updateField = (key: string, value: any) => {
        setForm((prev) => {
            let next = { ...prev, [key]: value }

            if (key === 'format' || key === 'format2' || key === 'format3') {
                console.log('CabinetInfo format changed:', key, value)
                next = applyLinkedData(next)
            }

            return next
        })
    }

    const handleSave = () => {
        onSave(form)
    }

    const SelectField = ({
        label,
        field,
        list = [],
    }: {
        label: string
        field: string
        list?: string[]
    }) => (
        <FormControl fullWidth>
            <InputLabel>{label}</InputLabel>
            <Select
                value={form[field] ?? ''}
                label={label}
                onChange={(e) => updateField(field, e.target.value)}
            >
                <MenuItem value="">
                    <em>未選択</em>
                </MenuItem>
                {list.map((v) => (
                    <MenuItem key={v} value={v}>
                        {v}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                筐体情報編集
                {!hasCombination && (
                    <span style={{ color: 'red', marginLeft: 10, fontSize: 14 }}>
                        （組み合わせなし）
                    </span>
                )}
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {!hasCombination && (
                        <Alert severity="warning">選択された設置場所・設備用途の組み合わせがありません。</Alert>
                    )}

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <SelectField label="設置場所" field="format" list={item.format || []} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <SelectField label="設備用途1" field="format2" list={item.format2 || []} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <SelectField label="設備用途2" field="format3" list={item.format3 || []} />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SelectField label="材質" field="material" list={item.material || []} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SelectField label="構造" field="structure" list={item.structure || []} />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 4 }}>
                            <ColorPickerDialog
                                colors={item.colors || {}}
                                onColorSelected={(color) => updateField('outer_color', color)}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 8 }}>
                            <SelectField label="塗装色" field="outer_color" list={colorNames as string[]} />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField
                                type="number"
                                label="横"
                                value={form.boxwidth ?? ''}
                                onChange={(e) => updateField('boxwidth', Number(e.target.value))}
                                fullWidth
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField
                                type="number"
                                label="縦"
                                value={form.boxheight ?? ''}
                                onChange={(e) => updateField('boxheight', Number(e.target.value))}
                                fullWidth
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField
                                type="number"
                                label="深さ"
                                value={form.boxdepth ?? ''}
                                onChange={(e) => updateField('boxdepth', Number(e.target.value))}
                                fullWidth
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField
                                type="number"
                                label="内規高さ"
                                value={form.support_height ?? ''}
                                onChange={(e) => updateField('support_height', Number(e.target.value))}
                                fullWidth
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SelectField label="入線" field="input_wire" list={item.input_wire || []} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SelectField label="出線" field="output_wire" list={item.output_wire || []} />
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