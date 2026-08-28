import { useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import { useAppStore, type AnyRecord } from "../../stores/useAppStore";
import { useConfigStore } from "../../stores/useConfigStore";
import {
  analyzeUnitSizeCompatibility,
  getUnitSizeCompatibilityError,
} from "../../utils/unitSizeCompatibility";

type UnitAddDialogProps = {
  open: boolean;
  onClose: () => void;
  onUnitsAdded?: (units: AnyRecord[]) => void;
};

type SearchMode = "ProductNo" | "SFD No" | "Unit No";

type Column = {
  title: string;
  key: string;
  action?: "select" | "device";
};

const searchModes: SearchMode[] = ["ProductNo", "SFD No", "Unit No"];

const productColumns: Column[] = [
  { title: "ProductNo", key: "product_no" },
  { title: "BoxNo", key: "box_no" },
  { title: "BoxH", key: "box_h" },
  { title: "BoxW", key: "box_w" },
  { title: "BoxColor", key: "box_color" },
  { title: "BoxDoor", key: "box_door" },
  { title: "BoxLocation", key: "box_Location" },
  { title: "BoxPurpose", key: "box_purpose" },
  { title: "BoxInput", key: "box_input" },
  { title: "BoxOutput", key: "box_output" },
  { title: "アクション", key: "actions", action: "select" },
];

const sfdColumns: Column[] = [
  { title: "SFDNo", key: "sfd_no" },
  { title: "UnitNo", key: "list_unit_no" },
  { title: "アクション", key: "actions", action: "select" },
];

const unitColumns: Column[] = [
  { title: "UnitNo", key: "unit_no" },
  { title: "選択", key: "actions", action: "select" },
  { title: "Cap", key: "i_cap" },
  { title: "縦", key: "i_unit_h" },
  { title: "横", key: "list_W" },
  { title: "内規高さ", key: "list_d" },
  { title: "構造 1", key: "structure1" },
  { title: "構造 2", key: "structure2" },
  { title: "機器確認", key: "actions2", action: "device" },
];

const fallbackPhaseOptions = [{ title: "1φ2W 100V", value: "1φ2W 100V" }];
const fallbackWireOptions = [{ title: "IV", value: "IV" }];

function formatValue(value: unknown) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isPlaceholder(value: unknown) {
  return typeof value === "string" && value.trim().startsWith("@");
}

function isSameBlockUnit(record: AnyRecord, block: unknown, unit: unknown) {
  const recordBlock =
    record.block ?? record.block_no ?? record.b ?? record.blockKey ?? record.block_key;
  const recordUnit =
    record.unit ?? record.subunit_no ?? record.unit_no ?? record.u ?? record.subunit;

  return recordBlock === block && recordUnit === unit;
}

async function placeAndUpdateByRawDevices(
  rawDevices: AnyRecord[],
  deviceList: AnyRecord[],
) {
  const done = new Set<string>();
  let nextDeviceList = deviceList;

  for (const record of Array.isArray(rawDevices) ? rawDevices : []) {
    const block = record.block;
    const unit = record.unit;
    if (!block || !unit) continue;

    const key = `${block}::${unit}`;
    if (done.has(key)) continue;

    const devices =
      Array.isArray(record.default_device) && record.default_device.length
        ? record.default_device
        : Array.isArray(record.over_device)
          ? record.over_device
          : [];
    const validDevices = devices.filter((device) => !isPlaceholder(device));
    if (validDevices.length === 0) {
      done.add(key);
      continue;
    }

    const placeRes = await axios.post("/api/postUnitPlaceOnly", {
      q: { subunit_no: unit, block_no: block },
      Device: validDevices,
      d: "-",
    });

    const lmap = Array.isArray(placeRes.data?.lmap) ? placeRes.data.lmap : [];
    const placedDevices = Array.isArray(placeRes.data?.device)
      ? placeRes.data.device
      : Array.isArray(placeRes.data?.devices)
        ? placeRes.data.devices
        : [];

    nextDeviceList = nextDeviceList.map((deviceRecord) =>
      isSameBlockUnit(deviceRecord, block, unit)
        ? {
            ...deviceRecord,
            lmap: deepCopy(lmap),
            devices: deepCopy(placedDevices),
          }
        : deviceRecord,
    );

    done.add(key);
  }

  return nextDeviceList;
}

async function fetchRawDevices(unitKey: string, phase: string, id: number) {
  const response = await axios.get(`/api/getUnitDevice?k=${unitKey}&p=${phase}`);
  const rawDevices = Array.isArray(response.data) ? response.data : [];

  return rawDevices.map((device) => ({ ...device, id }));
}

export default function UnitAddDialog({
  open,
  onClose,
  onUnitsAdded,
}: UnitAddDialogProps) {
  const config = useConfigStore((state) => state.config);
  const [mode, setMode] = useState<SearchMode>("Unit No");
  const [query, setQuery] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [phase, setPhase] = useState("");
  const [wire, setWire] = useState("");
  const [continuousMode, setContinuousMode] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectingKey, setSelectingKey] = useState("");
  const [error, setError] = useState("");
  const [deviceInfo, setDeviceInfo] = useState<AnyRecord[] | null>(null);

  const unitAddOption = config?.UnitAddOption ?? {};
  const phaseOptions = Array.isArray(unitAddOption.Phase)
    ? unitAddOption.Phase
    : fallbackPhaseOptions;
  const wireOptions = Array.isArray(unitAddOption.wire)
    ? unitAddOption.wire
    : fallbackWireOptions;
  const selectedPhase = phase || String(phaseOptions[0]?.value ?? "");
  const selectedWire = wire || String(wireOptions[0]?.value ?? "");

  const columns = useMemo(() => {
    if (mode === "ProductNo") return productColumns;
    if (mode === "SFD No") return sfdColumns;
    return unitColumns;
  }, [mode]);

  const filteredItems = useMemo(() => {
    const keywords = tableSearch.split(" ").filter(Boolean);
    if (keywords.length === 0) return items;

    return items.filter((item) =>
      keywords.every((keyword) =>
        Object.values(item).some((value) =>
          String(value).toLowerCase().includes(keyword.toLowerCase()),
        ),
      ),
    );
  }, [items, tableSearch]);

  const pagedItems = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const searchLabel =
    mode === "ProductNo" ? "プロダクト番号" : mode === "SFD No" ? "SFD番号" : "UnitNo";

  const fetchItems = async () => {
    setLoading(true);
    setError("");
    setDeviceInfo(null);

    try {
      const encodedQuery =
        mode === "Unit No" ? query.replace(/-/g, "_") : query;
      const endpoint =
        mode === "ProductNo"
          ? `/api/getProductList?n=${encodedQuery}`
          : mode === "SFD No"
            ? `/api/getSFDList?n=${encodedQuery}`
            : `/api/getUnitSearchByID?n=${encodedQuery}`;

      const response = await axios.get(endpoint);
      setItems(Array.isArray(response.data) ? response.data : []);
      setPage(0);
    } catch (fetchError) {
      console.error("[UnitAddDialog][fetchItems] failed", fetchError);
      setItems([]);
      setError("ユニット一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const selectItemV2 = async (item: AnyRecord) => {
    const unitNo = String(item.unit_no ?? "");
    const unitKey = String(item.unit_key ?? "");
    if (!unitNo || !unitKey) {
      setError("選択したユニットに unit_no または unit_key がありません。");
      return;
    }

    setSelectingKey(unitKey || unitNo);
    setError("");

    try {
      const state = useAppStore.getState();
      const compatibility = analyzeUnitSizeCompatibility([
        ...(state.input.unit.list ?? []),
        item,
      ]);
      if (!compatibility.valid) {
        setError(getUnitSizeCompatibilityError(compatibility));
        return;
      }

      const newId = state.input.unit.currentID;
      const gtr = await axios.get(`/api/getUnitGtr?u=${unitNo}&w=${selectedWire}`);
      const rawDevices = await fetchRawDevices(unitKey, selectedPhase, newId);
      const deviceListWithRaw = [
        ...(state.input.device.list ?? []),
        ...rawDevices,
      ];
      const nextDeviceList = await placeAndUpdateByRawDevices(
        rawDevices,
        deviceListWithRaw,
      );

      const nextUnit = {
        ...item,
        id: newId,
        wire: selectedWire,
        i_north: gtr.data.i_north,
        i_south: gtr.data.i_south,
      };

      useAppStore.setState((current) => ({
        ...current,
        input: {
          ...current.input,
          unit: {
            ...current.input.unit,
            currentID: newId + 1,
            list: [...(current.input.unit.list ?? []), nextUnit],
            newflag: 1,
          },
          device: {
            ...current.input.device,
            list: nextDeviceList,
          },
        },
      }));

      onUnitsAdded?.([nextUnit]);
      if (!continuousMode) onClose();
    } catch (selectError) {
      console.error("[UnitAddDialog][selectItemV2] failed", selectError);
      setError("ユニットの選択処理に失敗しました。");
    } finally {
      setSelectingKey("");
    }
  };

  const selectItemFromSearchListV2 = async (
    item: AnyRecord,
    options?: { applyProductCabinfo?: boolean },
  ) => {
    const listUnitNo = Array.isArray(item.list_unit_no) ? item.list_unit_no : [];
    if (listUnitNo.length === 0) {
      setError("選択した行に list_unit_no がありません。");
      return;
    }

    setSelectingKey(String(item.product_no ?? item.sfd_no ?? JSON.stringify(listUnitNo)));
    setError("");

    try {
      const state = useAppStore.getState();
      let currentId = state.input.unit.currentID;
      let nextUnitList = [...(state.input.unit.list ?? [])];
      let nextDeviceList = [...(state.input.device.list ?? [])];
      const addedUnits: AnyRecord[] = [];
      const foundUnits: Array<{ unitNo: string; unit: AnyRecord }> = [];

      for (const rawUnitNo of listUnitNo) {
        const unitNo = String(rawUnitNo ?? "");
        if (!unitNo || Number(unitNo)) continue;

        const unitResponse = await axios.get(`/api/getUnitSearchByID?n=${unitNo}`);
        const found = Array.isArray(unitResponse.data) ? unitResponse.data[0] : null;
        if (!found) continue;

        foundUnits.push({ unitNo, unit: found });
      }

      if (foundUnits.length === 0) {
        setError("追加可能なユニットが見つかりませんでした。");
        return;
      }

      const compatibility = analyzeUnitSizeCompatibility([
        ...nextUnitList,
        ...foundUnits.map(({ unit }) => unit),
      ]);
      if (!compatibility.valid) {
        setError(getUnitSizeCompatibilityError(compatibility));
        return;
      }

      for (const { unitNo, unit: found } of foundUnits) {
        const gtr = await axios.get(`/api/getUnitGtr?u=${unitNo}&w=${selectedWire}`);
        const rawDevices = await fetchRawDevices(unitNo, selectedPhase, currentId);
        nextDeviceList = await placeAndUpdateByRawDevices(rawDevices, [
          ...nextDeviceList,
          ...rawDevices,
        ]);

        const nextUnit = {
          ...found,
          id: currentId,
          wire: selectedWire,
          i_north: gtr.data.i_north,
          i_south: gtr.data.i_south,
        };

        nextUnitList = [...nextUnitList, nextUnit];
        addedUnits.push(nextUnit);
        currentId += 1;
      }

      useAppStore.setState((current) => ({
        ...current,
        input: {
          ...current.input,
          cabinfo: options?.applyProductCabinfo
            ? {
                ...current.input.cabinfo,
                boxwidth: item.box_w,
                boxheight: item.box_h,
                boxdepth: item.box_d,
                outer_color: item.box_color,
                material: item.box_material,
                input_wire: item.box_input,
                output_wire: item.box_output,
                structure: item.box_structure,
                format2: item.box_purpose,
                format: item.box_Location,
              }
            : current.input.cabinfo,
          unit: {
            ...current.input.unit,
            currentID: currentId,
            list: nextUnitList,
            newflag: 1,
          },
          device: {
            ...current.input.device,
            list: nextDeviceList,
          },
        },
      }));

      if (addedUnits.length > 0) onUnitsAdded?.(addedUnits);
      if (!continuousMode) onClose();
    } catch (selectError) {
      console.error("[UnitAddDialog][selectItemFromSearchListV2] failed", selectError);
      setError("ユニットの選択処理に失敗しました。");
    } finally {
      setSelectingKey("");
    }
  };

  const showDeviceInfo = async (item: AnyRecord) => {
    const unitKey = String(item.unit_key ?? "");
    if (!unitKey) {
      setDeviceInfo([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`/api/getUnitDevice?k=${unitKey}&p=${selectedPhase}`);
      setDeviceInfo(Array.isArray(response.data) ? response.data : []);
    } catch (deviceError) {
      console.error("[UnitAddDialog][showDeviceInfo] failed", deviceError);
      setDeviceInfo([]);
      setError("機器情報の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: AnyRecord) => {
    if (mode === "Unit No") {
      selectItemV2(item);
      return;
    }

    selectItemFromSearchListV2(item, {
      applyProductCabinfo: mode === "ProductNo",
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>ユニット追加</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2.5, pb: 0 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "stretch", md: "flex-start" }}
            spacing={2}
          >
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>検索種別</InputLabel>
              <Select
                value={mode}
                label="検索種別"
                onChange={(event) => {
                  setMode(event.target.value as SearchMode);
                  setQuery("");
                  setItems([]);
                  setTableSearch("");
                  setPage(0);
                  setDeviceInfo(null);
                }}
              >
                {searchModes.map((searchMode) => (
                  <MenuItem key={searchMode} value={searchMode}>
                    {searchMode}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={searchLabel}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") fetchItems();
              }}
              variant="standard"
              fullWidth
              sx={{ maxWidth: { md: 520 } }}
            />

            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Button
                variant="contained"
                endIcon={<CheckCircleIcon fontSize="small" />}
                onClick={fetchItems}
                disabled={loading}
                sx={{ minWidth: 84 }}
              >
                検索
              </Button>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={continuousMode}
                    onChange={(event) => setContinuousMode(event.target.checked)}
                  />
                }
                label="Stay"
                sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
              />
            </Stack>

            <Box sx={{ flexGrow: 1 }} />

            <Button variant="contained" onClick={onClose} sx={{ minWidth: 64 }}>
              戻る
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ mt: 5 }}>
            <FormControl variant="filled" size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Phase</InputLabel>
              <Select
                value={selectedPhase}
                label="Phase"
                onChange={(event) => setPhase(event.target.value)}
              >
                {phaseOptions.map((option: AnyRecord) => (
                  <MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.title ?? option.value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl variant="filled" size="small" sx={{ minWidth: 200 }}>
              <InputLabel>wire</InputLabel>
              <Select
                value={selectedWire}
                label="wire"
                onChange={(event) => setWire(event.target.value)}
              >
                {wireOptions.map((option: AnyRecord) => (
                  <MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.title ?? option.value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Box>

        <Stack spacing={1.5} sx={{ mt: 2.5 }}>
          {loading && <LinearProgress />}
          {error && (
            <Alert severity="error" sx={{ mx: 2 }}>
              {error}
            </Alert>
          )}
          {deviceInfo && (
            <Alert severity="info" sx={{ mx: 2 }}>
              機器情報: {deviceInfo.length}件
            </Alert>
          )}

          <TextField
            placeholder="Search"
            value={tableSearch}
            onChange={(event) => {
              setTableSearch(event.target.value);
              setPage(0);
            }}
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 0,
              },
            }}
          />

          <TableContainer component={Paper} square variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      sx={{
                        fontWeight: column.key === "unit_no" || column.key === "product_no" ? 700 : 400,
                        height: 44,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {column.title}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ height: 52 }}>
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedItems.map((item, index) => {
                    const rowKey = String(
                      item.unit_key ??
                        item.unit_no ??
                        item.product_no ??
                        item.sfd_no ??
                        `${page}-${index}`,
                    );
                    const isSelecting = selectingKey === rowKey;

                    return (
                      <TableRow key={rowKey} hover>
                        {columns.map((column) => {
                          if (column.action === "select") {
                            return (
                              <TableCell key={column.key} sx={{ whiteSpace: "nowrap" }}>
                                <Button
                                  variant="contained"
                                  size="small"
                                  disabled={Boolean(selectingKey)}
                                  onClick={() => handleSelect(item)}
                                >
                                  {isSelecting ? "選択中" : "選択"}
                                </Button>
                              </TableCell>
                            );
                          }

                          if (column.action === "device") {
                            return (
                              <TableCell key={column.key} sx={{ whiteSpace: "nowrap" }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => showDeviceInfo(item)}
                                >
                                  {formatValue(item.list_subunit_no) || "確認"}
                                </Button>
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell key={column.key} sx={{ whiteSpace: "nowrap" }}>
                              {formatValue(item[column.key])}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredItems.length}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="Items per page:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
