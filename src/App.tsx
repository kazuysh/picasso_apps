import { Box } from "@mui/material";
import AppHeader from "./components/AppHeader";
import AppRouter from "./router/AppRouter";

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ヘッダー部分：ルーター外 */}
      <AppHeader />

      {/* アプリケーション部分：ここだけルーター */}
      <Box sx={{ flex: 1 }}>
        <AppRouter />
      </Box>
    </Box>
  );
}