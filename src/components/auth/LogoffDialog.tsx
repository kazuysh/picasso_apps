import { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
    Stack,
} from "@mui/material";

export default function LogoffDialog() {
    const [open, setOpen] = useState(false);
    const [userID, setUserID] = useState("");

    // session取得（VueのonMounted相当）
    useEffect(() => {
        fetch("/api/sessioncheck", {
            method: "GET",
            credentials: "include",
        })
            .then((res) => res.json())
            .then((data) => {
                const id =
                    typeof data === "string"
                        ? data
                        : data?.session || data?.userID || "";
                setUserID(id);
            })
            .catch((err) => {
                console.error("sessioncheck error:", err);
            });
    }, []);

    const handleLogoff = async () => {
        try {
            const res = await fetch("/api/logoff", {
                method: "GET",
                credentials: "include",
            });

            const data = await res.json();
            console.log(data);

            // 強制リロード（これが一番安全）
            window.location.href = "/react";
        } catch (err) {
            console.error("logoff error:", err);
        }
    };

    return (
        <>
            {/* activator */}
            <Button color="inherit" onClick={() => setOpen(true)}>
                LogOff
            </Button>

            {/* dialog */}
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>LogOff</DialogTitle>

                <DialogContent dividers>
                    <Typography align="center" sx={{ mb: 2 }}>
                        ユーザーID：{userID}
                    </Typography>

                    <Stack spacing={2} alignItems="center">
                        <Button variant="contained" onClick={handleLogoff}>
                            LogOff
                        </Button>

                        <Button variant="outlined" onClick={() => setOpen(false)}>
                            Close Dialog
                        </Button>
                    </Stack>
                </DialogContent>

                <DialogActions />
            </Dialog>
        </>
    );
}