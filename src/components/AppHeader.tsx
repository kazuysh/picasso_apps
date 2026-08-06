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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LogoffDialog from "./auth/LogoffDialog";
import { useAppStore } from "../stores/useAppStore";
import { useSessionStore } from "../stores/useSessionStore";

const statusOptions = ["設計中", "確認中", "承認待ち", "完了"];

type SessionUser = {
    user_name: string;
    id_admin: number;
    full_name: string;
    update: string;
};

type GetSessionUserResponse = {
    user: SessionUser | null;
};

const DESIGNING_STATUS = "設計中";
const CONFIRMING_STATUS = "確認中";
const GENERAL_USER_STATUS_OPTIONS = [DESIGNING_STATUS, CONFIRMING_STATUS];

function getRequestErrorMessage(error: unknown, fallback: string) {
    if (axios.isAxiosError(error)) {
        const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
        return detail || error.message || fallback;
    }

    if (error instanceof Error) {
        return error.message || fallback;
    }

    return fallback;
}

export default function AppHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const input = useAppStore((state) => state.input);
    const projectMeta = useAppStore((state) => state.projectMeta);
    const updateInputData = useAppStore((state) => state.updateInputData);
    const clearSession = useSessionStore((state) => state.clearSession);

    const [storeDialogOpen, setStoreDialogOpen] = useState(false);
    const [status, setStatus] = useState(DESIGNING_STATUS);
    const [storeDrawingNo, setStoreDrawingNo] = useState("");
    const [copyToStore, setCopyToStore] = useState(true);
    const [storing, setStoring] = useState(false);
    const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
    const [loadingSessionUser, setLoadingSessionUser] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const drawingNo =
        input.basic?.drawingNoTemp ??
        input.basic?.drawingNo ??
        input.basic?.DrawingNo ??
        "";
    const isProjectListPage = location.pathname === "/";
    const isGeneralUser = sessionUser?.id_admin === 0;
    const sourceStatus = projectMeta?.status || DESIGNING_STATUS;
    const sourceUid = projectMeta?.uid || "";
    const sourceUserName = sourceUid.split("_")[0] || "";
    const selectableStatusOptions = isGeneralUser ? GENERAL_USER_STATUS_OPTIONS : statusOptions;
    const canGeneralUserChangeStatus =
        isGeneralUser &&
        !copyToStore &&
        sourceStatus === DESIGNING_STATUS &&
        (!sourceUserName || sourceUserName === sessionUser?.user_name);

    const fetchSessionUser = async () => {
        const sessionRes = await axios.get<GetSessionUserResponse>("/api/GetSessionUser", {
            withCredentials: true,
        });
        const nextSessionUser = sessionRes.data?.user ?? null;

        if (!nextSessionUser) {
            clearSession();
            navigate("/login", { replace: true });
            return null;
        }

        setSessionUser(nextSessionUser);
        if (nextSessionUser.id_admin === 0 && sourceStatus !== DESIGNING_STATUS) {
            setStatus(DESIGNING_STATUS);
        }

        return nextSessionUser;
    };

    const handleOpenStoreDialog = () => {
        setErrorMessage("");
        setStatus(DESIGNING_STATUS);
        setStoreDrawingNo(String(drawingNo || ""));
        setCopyToStore(true);
        setStoreDialogOpen(true);
        setLoadingSessionUser(true);
        fetchSessionUser()
            .catch((error: unknown) => {
                setErrorMessage(getRequestErrorMessage(error, "ユーザー情報の取得に失敗しました。"));
            })
            .finally(() => setLoadingSessionUser(false));
    };

    const handleCloseStoreDialog = () => {
        if (storing) return;
        setStoreDialogOpen(false);
    };

    const handleStatusChange = (event: SelectChangeEvent) => {
        const nextStatus = event.target.value;

        if (isGeneralUser && !GENERAL_USER_STATUS_OPTIONS.includes(nextStatus)) {
            return;
        }

        setStatus(nextStatus);
    };

    const handleCopyToStoreChange = (checked: boolean) => {
        setCopyToStore(checked);

        if (isGeneralUser) {
            setStatus(DESIGNING_STATUS);
        }
    };

    const handleMoveProjectList = () => {
        navigate("/");
    };

    const handleMoveGenzImport = () => {
        navigate("/Pages/GenzImport");
    };

    const handleMoveBaccsImport = () => {
        navigate("/Pages/BaccsImport");
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
            const latestSessionUser = await fetchSessionUser();

            if (!latestSessionUser) {
                return;
            }

            const isGeneralStoreUser = latestSessionUser.id_admin === 0;
            const sourceBelongsToCurrentUser =
                !sourceUserName || sourceUserName === latestSessionUser.user_name;

            if (isGeneralStoreUser) {
                if (!copyToStore && !sourceBelongsToCurrentUser) {
                    setErrorMessage("一般ユーザーは他ユーザー名義の図面を上書き保管できません。図面番号を変えてコピーして保管してください。");
                    return;
                }

                if (!copyToStore && sourceStatus !== DESIGNING_STATUS) {
                    setErrorMessage("一般ユーザーはステータスが設計中の図面のみ上書き保管できます。図面番号を変えてコピーして保管してください。");
                    return;
                }

                if (!copyToStore && !GENERAL_USER_STATUS_OPTIONS.includes(status)) {
                    setErrorMessage("一般ユーザーが選択できるステータスは設計中または確認中です。");
                    return;
                }
            }

            const storeStatus = isGeneralStoreUser && copyToStore ? DESIGNING_STATUS : status;

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
                    user: latestSessionUser.user_name,
                    dno,
                    overwrite: !copyToStore,
                    status: storeStatus,
                    full_name: latestSessionUser.full_name,
                },
                { withCredentials: true },
            );

            updateInputData(nextInput);
            useAppStore.setState((state) => ({
                ...state,
                projectMeta: {
                    uid: `${latestSessionUser.user_name}_${dno}`,
                    status: storeStatus,
                },
            }));
            setStoreDialogOpen(false);
        } catch (error: unknown) {
            setErrorMessage(getRequestErrorMessage(error, "保管に失敗しました。"));
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
                    {isProjectListPage && (
                        <>
                            <Button
                                color="inherit"
                                startIcon={<UploadFileIcon />}
                                onClick={handleMoveGenzImport}
                            >
                                原図
                            </Button>
                            <Button
                                color="inherit"
                                startIcon={<UploadFileIcon />}
                                onClick={handleMoveBaccsImport}
                            >
                                BACCS
                            </Button>
                        </>
                    )}
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
                                onChange={(event) => handleCopyToStoreChange(event.target.checked)}
                                disabled={loadingSessionUser}
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
                            disabled={loadingSessionUser || (isGeneralUser && !canGeneralUserChangeStatus)}
                        >
                            {selectableStatusOptions.map((item) => (
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
