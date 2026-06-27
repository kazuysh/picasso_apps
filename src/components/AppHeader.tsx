import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    Alert,
    AppBar,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Toolbar,
    Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SaveIcon from "@mui/icons-material/Save";
import LogoffDialog from "./auth/LogoffDialog";
import { useAppStore } from "../stores/useAppStore";
import { useSessionStore } from "../stores/useSessionStore";

const statusOptions = ["設計中", "確認中", "完了"];

type SessionUser = {
    user_name: string;
    id_admin: number;
    full_name: string;
    update: string;
};

type GetSessionUserResponse = {
    user: SessionUser | null;
};

export default function AppHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const input = useAppStore((state) => state.input);
    const updateInputData = useAppStore((state) => state.updateInputData);
    const clearSession = useSessionStore((state) => state.clearSession);

    const [storeDialogOpen, setStoreDialogOpen] = useState(false);
    const [status, setStatus] = useState("設計中");
    const [storeDrawingNo, setStoreDrawingNo] = useState("");
    const [copyToStore, setCopyToStore] = useState(true);
    const [storing, setStoring] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const drawingNo =
        input.basic?.drawingNoTemp ??
        input.basic?.drawingNo ??
        input.basic?.DrawingNo ??
        "";
    const isProjectListPage = location.pathname === "/";

    const handleOpenStoreDialog = () => {
        setErrorMessage("");
        setStatus("設計中");
        setStoreDrawingNo(String(drawingNo || ""));
        setCopyToStore(true);
        setStoreDialogOpen(true);
    };

    const handleCloseStoreDialog = () => {
        if (storing) return;
        setStoreDialogOpen(false);
    };

    const handleStatusChange = (event: SelectChangeEvent) => {
        setStatus(event.target.value);
    };

    const handleMoveProjectList = () => {
        navigate("/");
    };

    const handleStore = async () => {
        const originalDno = String(drawingNo || "").trim();
        const dno = String(storeDrawingNo || "").trim();

        if (!dno) {
            setErrorMessage("図面番号がないため保管できません。");
            return;
        }

        if (copyToStore && dno === originalDno) {
            setErrorMessage("コピーして保管する場合は、元の図面番号とは異なる図面番号を入力してください。");
            return;
        }

        if (!copyToStore && dno !== originalDno) {
            setErrorMessage("図面番号を変更する場合は、コピーして保管にチェックしてください。");
            return;
        }

        setStoring(true);
        setErrorMessage("");

        try {
            const sessionRes = await axios.get<GetSessionUserResponse>("/api/GetSessionUser", {
                withCredentials: true,
            });
            const sessionUser = sessionRes.data?.user;

            if (!sessionUser) {
                clearSession();
                navigate("/login", { replace: true });
                return;
            }

            const latestState = useAppStore.getState();
            const nextInput = {
                ...latestState.input,
                basic: {
                    ...(latestState.input?.basic ?? {}),
                    drawingNoTemp: dno,
                },
            };

            await axios.post(
                "/api/saveWork",
                {
                    input: nextInput,
                    output: latestState.output,
                    workblock: latestState.workblock,
                    layout: latestState.layout,
                },
                { withCredentials: true },
            );

            await axios.post(
                "/api/postWork2Stored",
                {
                    user: sessionUser.user_name,
                    dno,
                    overwrite: !copyToStore,
                    status,
                    full_name: sessionUser.full_name,
                },
                { withCredentials: true },
            );

            updateInputData(nextInput);
            setStoreDialogOpen(false);
        } catch (error: any) {
            const detail = error?.response?.data?.detail;
            setErrorMessage(detail || error?.message || "保管に失敗しました。");
        } finally {
            setStoring(false);
        }
    };

    return (
        <AppBar position="static" elevation={1}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
                    InSize
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {!isProjectListPage && (
                        <>
                            <Button
                                color="inherit"
                                startIcon={<ListAltIcon />}
                                onClick={handleMoveProjectList}
                            >
                                案件一覧
                            </Button>
                            <Button
                                color="inherit"
                                startIcon={<SaveIcon />}
                                onClick={handleOpenStoreDialog}
                            >
                                保管
                            </Button>
                        </>
                    )}
                    <LogoffDialog />
                </Box>
            </Toolbar>

            <Dialog open={storeDialogOpen} onClose={handleCloseStoreDialog} fullWidth maxWidth="sm">
                <DialogTitle>保管確認</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        保管内容を確認してください。
                    </DialogContentText>

                    <TextField
                        fullWidth
                        size="small"
                        label="図面番号"
                        value={storeDrawingNo}
                        onChange={(event) => setStoreDrawingNo(event.target.value)}
                        inputProps={{ maxLength: 16 }}
                        helperText={`${storeDrawingNo.length}/16`}
                        sx={{ mt: 2 }}
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={copyToStore}
                                onChange={(event) => setCopyToStore(event.target.checked)}
                            />
                        }
                        label="コピーして保管"
                        sx={{ mt: 1 }}
                    />

                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                        <InputLabel id="store-status-label">ステータス</InputLabel>
                        <Select
                            labelId="store-status-label"
                            value={status}
                            label="ステータス"
                            onChange={handleStatusChange}
                        >
                            {statusOptions.map((item) => (
                                <MenuItem key={item} value={item}>
                                    {item}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {errorMessage && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {errorMessage}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseStoreDialog} disabled={storing}>
                        キャンセル
                    </Button>
                    <Button
                        onClick={handleStore}
                        variant="contained"
                        disabled={storing}
                        startIcon={storing ? <CircularProgress size={16} /> : undefined}
                    >
                        保管
                    </Button>
                </DialogActions>
            </Dialog>
        </AppBar>
    );
}
