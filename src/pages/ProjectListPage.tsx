import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Typography,
  Paper,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { SelectChangeEvent } from "@mui/material/Select";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DialogNoInput from "../components/DialogNoInput";
import { useAppStore, type AppState } from "../stores/useAppStore";

type Project = {
  id: number;
  status: string;
  projectName: string;
  drawingNo: string;
  assignee: string;
  updatedAt: string;
  workdata?: Partial<AppState>;
};

type WorkdataRecord = {
  UID?: string;
  status?: string;
  created?: string;
  updated?: string;
  data?: Partial<AppState>;
};

type SessionCheckResponse = {
  session?: string;
  status?: number;
};

type PostWorkCollByPageResponse = {
  code: number;
  result?: {
    data?: WorkdataRecord[];
    total?: number;
  };
  msg?: string;
};

const statusOptions: string[] = ["すべて", "設計中", "確認中", "承認待ち", "完了"];
const PAGE_SIZE = 10;

function getStatusColor(status: string): "default" | "primary" | "secondary" | "success" | "warning" {
  switch (status) {
    case "設計中":
      return "primary";
    case "確認中":
      return "warning";
    case "承認待ち":
      return "secondary";
    case "完了":
      return "success";
    default:
      return "default";
  }
}

function formatDate(value?: string): string {
  if (!value) return "2026/--/--";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "2026/--/--";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

type ProjectCardProps = {
  project: Project;
  selected: boolean;
  onOpen: (project: Project) => void;
};

function ProjectCard({ project, selected, onOpen }: ProjectCardProps) {
  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        borderRadius: 2,
        backgroundColor: "background.paper",
      }}
    >
      <CardActionArea onClick={() => onOpen(project)}>
        <CardContent sx={{ px: 3, py: 2.5 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  label={project.status}
                  color={getStatusColor(project.status)}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {project.projectName}
                </Typography>
              </Stack>

              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                図面番号：{project.drawingNo}
              </Typography>
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0.5, sm: 3 }}
              sx={{ whiteSpace: "nowrap" }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                担当：{project.assignee}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                更新日：{project.updatedAt}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function ProjectListPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("すべて");
  const [page, setPage] = useState<number>(1);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"new" | "copy">("new");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [totalCount, setTotalCount] = useState<number>(0);
  const navigate = useNavigate();

  const replaceAll = useAppStore((state) => state.replaceAll);

  const fetchProjects = async (currentPage: number) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const sessionRes = await axios.get<SessionCheckResponse>("/api/sessioncheck", {
        withCredentials: true,
      });

      const userID = sessionRes.data?.session || "";

      if (!userID) {
        throw new Error("sessioncheck から session を取得できませんでした。");
      }

      const params = {
        startPage: (currentPage - 1) * PAGE_SIZE + 1,
        length: PAGE_SIZE,
        filter: {
          $and: [
            {
              UID: { $regex: `^${userID}_` },
            },
          ],
        },
        collection: "storeddata",
        sortkey: "created",
        sortorder: "asc",
      };

      const res = await axios.post<PostWorkCollByPageResponse>(
        "/api/postWorkCollByPage",
        params,
        { withCredentials: true }
      );

      if (res.data?.code !== 200) {
        throw new Error(res.data?.msg || "postWorkCollByPage エラー");
      }

      const rows = res.data?.result?.data || [];
      const total = res.data?.result?.total || 0;

      const mapped: Project[] = rows.map((item, index) => {
        const basic = item?.data?.input?.basic || {};

        return {
          id: (currentPage - 1) * PAGE_SIZE + index + 1,
          drawingNo: basic?.drawingNoTemp || "",
          projectName: basic?.subjectName || basic?.drawingsubjectName || "",
          assignee: "XXXXXX",
          updatedAt: formatDate(item?.updated || item?.created),
          status: item?.status || "設計中",
          workdata: item?.data || {},
        };
      });

      setProjects(mapped);
      setTotalCount(total);
    } catch (error: any) {
      console.error("案件一覧取得エラー:", error);
      setProjects([]);
      setTotalCount(0);
      setErrorMsg(error?.message || "案件一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects(page);
  }, [page]);

  const filteredProjects = useMemo<Project[]>(() => {
    return selectedStatus === "すべて"
      ? projects
      : projects.filter((item) => item.status === selectedStatus);
  }, [projects, selectedStatus]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const startIndex = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = totalCount === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + projects.length, totalCount);

  const selectedProject =
    filteredProjects.find((item) => item.id === selectedProjectId) ??
    projects.find((item) => item.id === selectedProjectId) ??
    null;

  const handleChangeStatus = (event: SelectChangeEvent<string>) => {
    setSelectedStatus(event.target.value);
  };

  const handleOpenProject = (project: Project) => {
    setSelectedProjectId(project.id);

    const workdata = project.workdata || {};

    replaceAll({
      generationStartStep: 'full',
      input: {
        basic: workdata.input?.basic || {},
        cabinfo: workdata.input?.cabinfo || {},
        caboption: workdata.input?.caboption || {},
        unit: workdata.input?.unit || { currentID: 10000, list: [], newflag: 0 },
        circuit: workdata.input?.circuit || {},
        device: workdata.input?.device || { list: [] },
      },
      output: {
        box: workdata.output?.box || {},
      },
      workblock: {
        block: workdata.workblock?.block || {},
      },
      layout: {
        floor: workdata.layout?.floor || {},
        layout: workdata.layout?.layout || [],
        ulf: workdata.layout?.ulf || {},
        box: workdata.layout?.box || {},
        boxw: workdata.layout?.boxw || ['500', '20', '500', '20', '500', '20'],
        boxg: workdata.layout?.boxg || [],
        boxgb: workdata.layout?.boxgb || 0,
        boxh: workdata.layout?.boxh || 0,
        boxH: workdata.layout?.boxH || 0,
        nrow: workdata.layout?.nrow || 0,
        backgroundSvgUrl: workdata.layout?.backgroundSvgUrl || '',
        svg: workdata.layout?.svg || '',
      },
    });

    console.log("カードクリック → useAppStoreへ保存 → project-detail遷移", project);
    navigate("/project-detail");
  };

  const handleCreateNew = () => {
    setDialogMode("new");
    setDialogOpen(true);
  };

  const handleCopyCreate = () => {
    if (!selectedProject) {
      alert("コピー元の案件を選択してください。");
      return;
    }
    setDialogMode("copy");
    setDialogOpen(true);
  };

  return (
    <>
      <Box sx={{ minHeight: "100vh", backgroundColor: "#f6f7fb", py: 3 }}>
        <Container maxWidth="xl">
          <Paper
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
              backgroundColor: "background.paper",
            }}
          >
            <Box sx={{ p: 3 }}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={3}
                alignItems={{ xs: "stretch", lg: "flex-start" }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    width: { xs: "100%", lg: 280 },
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                    検索条件
                  </Typography>

                  <FormControl fullWidth size="small">
                    <InputLabel id="status-label">ステータス</InputLabel>
                    <Select
                      labelId="status-label"
                      value={selectedStatus}
                      label="ステータス"
                      onChange={handleChangeStatus}
                    >
                      {statusOptions.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    今後、図面番号検索などの追加項目を配置できる想定です。
                  </Typography>
                </Paper>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                    spacing={2}
                    sx={{ mb: 2 }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      案件一覧
                    </Typography>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <Button
                        variant="outlined"
                        startIcon={<ContentCopyIcon />}
                        onClick={handleCopyCreate}
                      >
                        コピーして作成
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={handleCreateNew}
                      >
                        新規案件作成
                      </Button>
                    </Stack>
                  </Stack>

                  {loading ? (
                    <Paper
                      elevation={0}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        p: 4,
                        textAlign: "center",
                      }}
                    >
                      <CircularProgress size={28} />
                      <Typography sx={{ mt: 2 }}>案件一覧を取得中です...</Typography>
                    </Paper>
                  ) : errorMsg ? (
                    <Paper
                      elevation={0}
                      sx={{
                        border: "1px solid",
                        borderColor: "error.main",
                        borderRadius: 2,
                        p: 3,
                      }}
                    >
                      <Typography color="error" sx={{ fontWeight: 700, mb: 1 }}>
                        一覧取得エラー
                      </Typography>
                      <Typography variant="body2">{errorMsg}</Typography>
                    </Paper>
                  ) : (
                    <>
                      <Stack spacing={2}>
                        {filteredProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            selected={selectedProjectId === project.id}
                            onOpen={handleOpenProject}
                          />
                        ))}
                      </Stack>

                      {filteredProjects.length === 0 && (
                        <Paper
                          elevation={0}
                          sx={{
                            mt: 2,
                            border: "1px dashed",
                            borderColor: "divider",
                            borderRadius: 2,
                            p: 3,
                            textAlign: "center",
                            color: "text.secondary",
                          }}
                        >
                          該当する案件はありません。
                        </Paper>
                      )}
                    </>
                  )}

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={2}
                    sx={{ mt: 3 }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {totalCount} 件中 {startIndex} - {endIndex} 件を表示
                    </Typography>

                    <Pagination
                      color="primary"
                      page={page}
                      count={pageCount}
                      onChange={(_, value: number) => setPage(value)}
                    />
                  </Stack>

                  <Paper
                    elevation={0}
                    sx={{
                      mt: 3,
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                      backgroundColor: "grey.50",
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <FolderOpenIcon fontSize="small" />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        選択中案件
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {selectedProject
                        ? `${selectedProject.projectName} / ${selectedProject.drawingNo}`
                        : "カードをクリックすると対象案件が選択されます。"}
                    </Typography>
                  </Paper>
                </Box>
              </Stack>
            </Box>
          </Paper>
        </Container>
      </Box>

      <DialogNoInput
        open={dialogOpen}
        mode={dialogMode}
        sourceProject={selectedProject}
        label="図面番号"
        placeholder="図面番号を入力してください"
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
