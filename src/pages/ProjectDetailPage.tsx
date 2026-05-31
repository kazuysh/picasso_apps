import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import { useAppStore } from "../stores/useAppStore";
import { useConfigStore } from "../stores/useConfigStore";
import BasicInfoDialog from "../components/project/BasicInfoDialog";
import CabinetInfoDialog from "../components/project/CabinetInfoDialog";
import CabinetOptionDialog from "../components/project/CabinetOptionDialog";
import CircuitDesignTab from "../components/project/CircuitDesignTab";
import LayoutDesignTab from "../components/project/LayoutDesignTab";
import ResultDisplayTab from "../components/project/ResultDisplayTab";

type KeyValueRecord = Record<string, any>;

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type FieldViewProps = {
  data: KeyValueRecord;
  dict?: Record<string, string>;
};

function FieldView(props: FieldViewProps) {
  const { data, dict } = props;
  const labelDict = dict ?? {};
  const entries = Object.entries(data || {});

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        データがありません
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {entries.map(([key, value]) => {
        const label = labelDict[key] ?? key;

        return (
          <Box
            key={key}
            sx={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: 1,
              alignItems: "start",
              borderBottom: "1px solid #eee",
              pb: 0.75,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {label}
            </Typography>

            <Box>
              {Array.isArray(value) || isObject(value) ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    bgcolor: "#fafafa",
                    fontFamily: "monospace",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {JSON.stringify(value, null, 2)}
                </Paper>
              ) : (
                <Typography variant="body2">{String(value ?? "")}</Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export default function ProjectDetailPage() {
  const navigate = useNavigate();

  const input = useAppStore((state) => state.input);
  const layout = useAppStore((state) => state.layout);
  const applyCircuitGraphDataEdit = useAppStore(
    (state) => state.applyCircuitGraphDataEdit,
  );
  const applyLayoutDataEdit = useAppStore(
    (state) => state.applyLayoutDataEdit,
  );

  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchData);

  const [activeTab, setActiveTab] = useState<"circuit" | "layout" | "result">(
    "circuit",
  );
  const [basicDialogOpen, setBasicDialogOpen] = useState(false);
  const [cabinetDialogOpen, setCabinetDialogOpen] = useState(false);
  const [cabinetOptionDialogOpen, setCabinetOptionDialogOpen] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleGenerate = () => {
    navigate("/GenerationRunnerPage");
  };

  const circuitGraphData = input.circuit?.graphdata;
  const layoutSvg = (input.circuit as any)?.svg || layout?.svg || "";
  const basicInfoItem = config?.BasicInfoOption || {};
  const cabinetInfoItem = config?.CabinetinfoOption || {};
  const cabinetOptionItem = config?.CabinetOption || {};
  const basicInfoDict = basicInfoItem?.BasicinfoDict || {};
  const cabinetInfoDict = cabinetInfoItem?.CabinetinfoDict || {};

  const handleSaveBasicInfo = (nextBasic: Record<string, any>) => {
    const store: any = (useAppStore as any).getState?.();

    if (typeof store?.setInput === "function") {
      store.setInput({
        ...store.input,
        basic: nextBasic,
      });
    } else if (typeof store?.setBasic === "function") {
      store.setBasic(nextBasic);
    } else if (typeof useAppStore.setState === "function") {
      useAppStore.setState((state: any) => ({
        input: {
          ...state.input,
          basic: nextBasic,
        },
      }));
    } else {
      console.warn(
        "useAppStore の更新関数が見つかりません。setInput / setBasic / setState に合わせて修正してください。",
      );
    }
    setBasicDialogOpen(false);
  };

  const handleSaveCabinetInfo = (nextCabinfo: Record<string, any>) => {
    const store: any = (useAppStore as any).getState?.();

    if (typeof store?.setInput === "function") {
      store.setInput({
        ...store.input,
        cabinfo: nextCabinfo,
      });
    } else if (typeof useAppStore.setState === "function") {
      useAppStore.setState((state: any) => ({
        input: {
          ...state.input,
          cabinfo: nextCabinfo,
        },
      }));
    } else {
      console.warn("useAppStore の更新関数に合わせて修正してください。");
    }

    setCabinetDialogOpen(false);
  };

  const handleSaveCabinetOption = (nextCaboption: Record<string, any>) => {
    const store: any = (useAppStore as any).getState?.();

    if (typeof store?.setInput === "function") {
      store.setInput({
        ...store.input,
        caboption: nextCaboption,
      });
    } else if (typeof useAppStore.setState === "function") {
      useAppStore.setState((state: any) => ({
        input: {
          ...state.input,
          caboption: nextCaboption,
        },
      }));
    } else {
      console.warn("useAppStore の更新関数に合わせて修正してください。");
    }

    setCabinetOptionDialogOpen(false);
  };

  const handleInputChange = (nextInput: Record<string, any>) => {
    const store: any = (useAppStore as any).getState?.();

    if (typeof store?.setInput === "function") {
      store.setInput(nextInput);
    } else if (typeof (useAppStore as any).setState === "function") {
      (useAppStore as any).setState({ input: nextInput });
    } else {
      console.warn(
        "useAppStore の更新関数が見つかりません。setInput / setState に合わせて修正してください。",
      );
    }
  };

  const handleLayoutChange = (nextLayout: Record<string, any>) => {
    applyLayoutDataEdit(nextLayout as any);
  };

  const handleCircuitGraphdataChange = (nextGraphdata: Record<string, any>) => {
    applyCircuitGraphDataEdit(nextGraphdata as any);
  };

  return (
    <Box sx={{ p: 2, bgcolor: "#efefef", minHeight: "100vh" }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper
            elevation={1}
            sx={{
              p: 0,
              height: "100%",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                bgcolor: "#d9d9d9",
                fontWeight: 700,
                borderBottom: "1px solid #bbb",
              }}
            >
              案件・仕様設定
            </Box>

            <Accordion defaultExpanded disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pr: 1,
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>基本情報</Typography>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBasicDialogOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <FieldView data={input.basic || {}} dict={basicInfoDict} />
              </AccordionDetails>
            </Accordion>

            <Accordion disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pr: 1,
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>筐体情報</Typography>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCabinetDialogOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <FieldView data={input.cabinfo || {}} dict={cabinetInfoDict} />
              </AccordionDetails>
            </Accordion>

            <Accordion disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    pr: 1,
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    筐体オプション
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCabinetOptionDialogOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <FieldView data={input.caboption || {}} />
              </AccordionDetails>
            </Accordion>

            <Box sx={{ p: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleGenerate}
                sx={{ borderRadius: 2 }}
              >
                回路・配置生成
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 9 }}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(_, value) =>
                setActiveTab(value as "circuit" | "layout" | "result")
              }
              sx={{ mb: 2 }}
            >
              <Tab label="回路設計" value="circuit" />
              <Tab label="配置設計" value="layout" />
              <Tab label="結果表示" value="result" />
            </Tabs>

            <Divider sx={{ mb: 2 }} />

            {activeTab === "circuit" && (
              <CircuitDesignTab
                graphdata={circuitGraphData}
                onGraphdataChange={handleCircuitGraphdataChange}
              />
            )}
            {activeTab === "layout" && (
              <LayoutDesignTab
                svgText={layoutSvg}
                input={input}
                layout={layout}
                onInputChange={handleInputChange}
                onLayoutChange={handleLayoutChange}
              />
            )}
            {activeTab === "result" && <ResultDisplayTab />}
          </Paper>
        </Grid>
      </Grid>

      <BasicInfoDialog
        open={basicDialogOpen}
        initialData={input.basic || {}}
        item={basicInfoItem}
        onClose={() => setBasicDialogOpen(false)}
        onSave={handleSaveBasicInfo}
      />

      <CabinetInfoDialog
        open={cabinetDialogOpen}
        initialData={input.cabinfo || {}}
        item={cabinetInfoItem}
        onClose={() => setCabinetDialogOpen(false)}
        onSave={handleSaveCabinetInfo}
      />

      <CabinetOptionDialog
        open={cabinetOptionDialogOpen}
        initialData={input.caboption || {}}
        item={cabinetOptionItem}
        onClose={() => setCabinetOptionDialogOpen(false)}
        onSave={handleSaveCabinetOption}
      />
    </Box>
  );
}
