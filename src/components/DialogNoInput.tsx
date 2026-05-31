import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";

type Mode = "new" | "copy";
type LoadMode = "none" | "json" | "xlsx";

type Project = {
    id: number;
    status: string;
    projectName: string;
    drawingNo: string;
    assignee: string;
    updatedAt: string;
};

type DialogNoInputProps = {
    open: boolean;
    mode: Mode;
    sourceProject?: Project | null;
    placeholder?: string;
    label?: string;
    onClose: () => void;
};

const IMPORT_API_BY_LOAD_MODE: Record<Exclude<LoadMode, "none">, string> = {
    json: "/api/postWorkdataUnitDevice",
    xlsx: "/api/postWorkdataUnitDeviceExcel",
};

const FILE_ACCEPT_BY_LOAD_MODE: Record<Exclude<LoadMode, "none">, string> = {
    json: "application/json,.json",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx",
};

function createDefaultInput() {
    return {
        basic: {},
        cabinfo: {
            input_wire: "上",
            output_wire: "下",
            selectedcategory: "IV",
            selectedarea: "100.0",
            selectedstandard: "JIS",
        },
        caboption: {},
        unit: { currentID: 10000, list: [], newflag: 0 },
        circuit: {},
        device: { list: [] },
    };
}

function createDefaultLayout() {
    return {
        floor: {},
        layout: [],
        boxg: ["150", "150", "150"],
        backgroundSvgUrl: "/api/getTemplate?w=500,50,500,50,500,50&h=2300",
        nrow: 3,
        boxH: 2300,
        box: {},
        boxcode: "",
        svg: "",
        Info: {},
        boxw: ["500", "50", "500", "50", "500", "50"],
        boxh: "2300",
        boxgb: "150",
    };
}

async function getSessionId(): Promise<string> {
    try {
        const res = await fetch("/api/sessioncheck", {
            method: "GET",
            credentials: "include",
        });

        const data = await res.json();

        if (typeof data === "string") return data;
        if (data && typeof data.session === "string") return data.session;
        if (data && typeof data.userID === "string") return data.userID;
        if (data?.data && typeof data.data.session === "string") return data.data.session;

        console.warn("sessioncheck response unexpected:", data);
        return "session";
    } catch (e) {
        console.error("session取得失敗", e);
        return "session";
    }
}

export default function DialogNoInput({
    open,
    mode,
    sourceProject,
    placeholder = "図面番号を入力してください",
    label = "図面番号",
    onClose,
}: DialogNoInputProps) {
    const navigate = useNavigate();
    const inputFileRef = useRef<HTMLInputElement | null>(null);

    const store = useAppStore();
    const replaceAll = useAppStore((state) => state.replaceAll);

    const [drawingNoTemp, setDrawingNoTemp] = useState("");
    const [loadMode, setLoadMode] = useState<LoadMode>("none");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;

        if (mode === "copy" && sourceProject?.drawingNo) {
            setDrawingNoTemp(sourceProject.drawingNo);
        } else {
            setDrawingNoTemp("");
        }
        setLoadMode("none");
    }, [open, mode, sourceProject]);

    const initNewForm = () => {
        if (mode !== "new") return;

        replaceAll({
            ...store,
            input: createDefaultInput(),
            output: { box: {} },
            workblock: { block: {} },
            layout: createDefaultLayout(),
        });
    };

    const finalizeSave = () => {
        const latest = useAppStore.getState();

        replaceAll({
            ...latest,
            input: {
                ...latest.input,
                basic: {
                    ...(latest.input?.basic ?? {}),
                    drawingNoTemp,
                },
            },
        });

        onClose();
        navigate("/GenerationRunnerPage");
    };

    const applyImportedUnitDevice = (result: any) => {
        const latest = useAppStore.getState();

        replaceAll({
            ...latest,
            input: {
                ...latest.input,
                unit: {
                    currentID: result.currentID ?? 10000,
                    list: result.unit ?? [],
                    newflag: latest.input?.unit?.newflag ?? 0,
                },
                device: {
                    list: result.device ?? [],
                },
            },
        });
    };

    const handleLoadModeChange = (event: SelectChangeEvent) => {
        setLoadMode(event.target.value as LoadMode);
    };

    const handleSave = async () => {
        if (!drawingNoTemp.trim()) {
            alert("図面番号を入力してください。");
            return;
        }

        initNewForm();

        if (loadMode !== "none") {
            inputFileRef.current?.click();
            return;
        }

        finalizeSave();
    };

    const importJsonFile = async (file: File) => {
        const text = await file.text();
        const importedJson = JSON.parse(text);
        const sessionId = await getSessionId();

        const response = await fetch(IMPORT_API_BY_LOAD_MODE.json, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                reqKey: `${sessionId}_${drawingNoTemp}`,
                start_id: 10001,
                type: "json",
                req_data: importedJson,
                save: false,
            }),
        });

        const result = await response.json();

        if (!response.ok || result?.ok !== true) {
            throw new Error(
                result?.message || "postWorkdataUnitDevice の呼び出しに失敗しました"
            );
        }

        return result;
    };

    const importExcelFile = async (file: File) => {
        const sessionId = await getSessionId();
        const formData = new FormData();

        formData.append("file", file);
        formData.append("reqKey", `${sessionId}_${drawingNoTemp}`);
        formData.append("start_id", "10001");
        formData.append("type", "xlsx");
        formData.append("save", "false");

        const response = await fetch(IMPORT_API_BY_LOAD_MODE.xlsx, {
            method: "POST",
            credentials: "include",
            body: formData,
        });

        const result = await response.json();

        if (!response.ok || result?.ok !== true) {
            throw new Error(
                result?.message || "postWorkdataUnitDeviceExcel の呼び出しに失敗しました"
            );
        }

        return result;
    };

    const handleImportFileChange = async (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file || loadMode === "none") return;

        setSaving(true);

        try {
            const result =
                loadMode === "xlsx"
                    ? await importExcelFile(file)
                    : await importJsonFile(file);

            applyImportedUnitDevice(result);
            finalizeSave();
        } catch (error: any) {
            console.error(error);
            alert(error?.message || "ファイルロードに失敗しました");
        } finally {
            setSaving(false);
            if (event.target) {
                event.target.value = "";
            }
        }
    };

    const dialogTitle = mode === "new" ? "新規" : "コピーして作成";
    const fileAccept = loadMode === "none" ? undefined : FILE_ACCEPT_BY_LOAD_MODE[loadMode];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{dialogTitle}</DialogTitle>

            <DialogContent dividers>
                <TextField
                    fullWidth
                    margin="normal"
                    label={label}
                    placeholder={placeholder}
                    value={drawingNoTemp}
                    onChange={(e) => setDrawingNoTemp(e.target.value)}
                    inputProps={{ maxLength: 16 }}
                    helperText={`${drawingNoTemp.length}/16`}
                />

                <FormControl fullWidth margin="normal">
                    <InputLabel id="load-mode-label">ロード方法</InputLabel>
                    <Select
                        labelId="load-mode-label"
                        value={loadMode}
                        label="ロード方法"
                        onChange={handleLoadModeChange}
                    >
                        <MenuItem value="none">なし</MenuItem>
                        <MenuItem value="json">JSONロード</MenuItem>
                        <MenuItem value="xlsx">EXCELロード</MenuItem>
                    </Select>
                </FormControl>

                <input
                    ref={inputFileRef}
                    type="file"
                    accept={fileAccept}
                    style={{ display: "none" }}
                    onChange={handleImportFileChange}
                />
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    キャンセル
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                    保存
                </Button>
            </DialogActions>
        </Dialog>
    );
}
