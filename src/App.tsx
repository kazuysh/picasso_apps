import { Box } from "@mui/material";
import AppRouter from "./router/AppRouter";

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppRouter />
    </Box>
  );
}
