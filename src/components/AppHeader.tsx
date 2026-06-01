import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    Alert,
    AppBar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Toolbar,
    Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SaveIcon from "@mui/icons-material/Save";
import LogoffDialog from "./auth/LogoffDialog";
import { saveWork } from "../api/saveWork";
import { useAppStore } from "../stores/useAppStore";

const statusOptions = ["設計中", "確認中", "承認待ち", "完了"];

export default function AppHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const input = useAppStore((state) => state.input);

    const [storeDialogOpen, setStoreDialogOpen] = useState(false);
    const [status, setStatus] = useState("設計中");
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
        const dno = String(drawingNo || "").trim();

        if (!dno) {
            setErrorMessage("図面番号がないため保管できません。");
            return;
        }

        setStoring(true);
        setErrorMessage("");

        try {
            await saveWork();

            const sessionRes = await axios.get("/api/sessioncheck", {
                withCredentials: true,
            });
            const user = sessionRes.data?.session || sessionRes.data?.userID || "";

            if (!user) {
                throw new Error("sessioncheck からユーザーIDを取得できませんでした。");
            }

            await axios.post(
                "/api/postWork2Stored",
                {
                    user,
                    dno,
                    overwrite: true,
                    status,
                },
                { withCredentials: true },
            );

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
                        保管時のステータスを選択してください。
                    </DialogContentText>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        図面番号: {String(drawingNo || "")}
                    </Typography>

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
