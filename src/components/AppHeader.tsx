import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import LogoffDialog from "./auth/LogoffDialog";

export default function AppHeader() {
    return (
        <AppBar position="static" elevation={1}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
                    InSize
                </Typography>

                {/* 右側にLogoff */}
                <Box>
                    <LogoffDialog />
                </Box>
            </Toolbar>
        </AppBar>
    );
}
