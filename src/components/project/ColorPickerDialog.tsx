import { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material'

type ColorData = Record<
    string,
    {
        NAME: string
        RGB: string
    }
>

type Props = {
    colors?: ColorData
    onColorSelected: (colorName: string) => void
}

export default function ColorPickerDialog({ colors = {}, onColorSelected }: Props) {
    const [open, setOpen] = useState(false)

    const standardColors = useMemo(
        () => ['color1', 'color2'].map((key) => colors[key]).filter(Boolean),
        [colors]
    )

    const quasiStandardColors1 = useMemo(
        () =>
            [
                'color3',
                'color4',
                'color5',
                'color6',
                'color7',
                'color8',
                'color9',
                'color10',
                'color11',
                'color12',
                'color13',
            ]
                .map((key) => colors[key])
                .filter(Boolean),
        [colors]
    )

    const quasiStandardColors2 = useMemo(
        () =>
            [
                'color14',
                'color15',
                'color16',
                'color17',
                'color18',
                'color19',
                'color20',
                'color21',
                'color22',
                'color23',
            ]
                .map((key) => colors[key])
                .filter(Boolean),
        [colors]
    )

    const selectColor = (name: string) => {
        onColorSelected(name)
        setOpen(false)
    }

    const ColorButtons = ({ list }: { list: { NAME: string; RGB: string }[] }) => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {list.map((color) => (
                <Button
                    key={color.NAME}
                    variant="outlined"
                    size="small"
                    title={color.NAME}
                    onClick={() => selectColor(color.NAME)}
                    sx={{
                        minWidth: 34,
                        width: 34,
                        height: 28,
                        bgcolor: color.RGB,
                        borderColor: '#999',
                    }}
                />
            ))}
        </Stack>
    )

    return (
        <>
            <Button variant="contained" color="secondary" onClick={() => setOpen(true)}>
                Color Picker
            </Button>

            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>ColorPicker</DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={3}>
                        <Box>
                            <Typography sx={{ mb: 1 }}>標準色</Typography>
                            <ColorButtons list={standardColors as any} />
                        </Box>

                        <Box>
                            <Typography sx={{ mb: 1 }}>準標準色</Typography>
                            <Stack spacing={1}>
                                <ColorButtons list={quasiStandardColors1 as any} />
                                <ColorButtons list={quasiStandardColors2 as any} />
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setOpen(false)}>閉じる</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}