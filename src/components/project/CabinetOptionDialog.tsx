import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import DeleteIcon from "@mui/icons-material/Delete";

type KeyValueRecord = Record<string, any>;

type HeaderDef = {
  key: string;
  title?: string;
};

type SelectDef = {
  label: string;
  items: string[];
};

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function makeRowId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "(空白)";
  return String(value);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type OptionListDialogProps = {
  open: boolean;
  unitBlock: { block_no?: string; phase?: string };
  onClose: () => void;
  onAdd: (items: KeyValueRecord[]) => void;
};

function OptionListDialog(props: OptionListDialogProps) {
  const { open, unitBlock, onClose, onAdd } = props;

  const [selectDefs, setSelectDefs] = useState<SelectDef[]>([]);
  const [selectDname, setSelectDname] = useState<string[]>([]);
  const [headers, setHeaders] = useState<HeaderDef[]>([]);
  const [deviceData, setDeviceData] = useState<KeyValueRecord[]>([]);
  const [selectedNos, setSelectedNos] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );

  const filterableHeaderKeys = useMemo(
    () =>
      headers
        .map((h) => h.key)
        .filter(
          (key) => key && key !== "data-table-select" && key !== "selectable",
        ),
    [headers],
  );

  const activeFilterCount = useMemo(
    () =>
      Object.values(columnFilters).filter(
        (v) => v !== null && v !== undefined && v !== "",
      ).length,
    [columnFilters],
  );

  const resetTableState = () => {
    setHeaders([]);
    setDeviceData([]);
    setSelectedNos(new Set());
    setSearch("");
    setColumnFilters({});
  };

  const fetchOptionList = async (nextSelectDname = selectDname) => {
    if (!unitBlock?.block_no) {
      resetTableState();
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append("b", unitBlock.block_no);
      nextSelectDname.forEach((name) => params.append("d", name ?? ""));

      const response = await fetch(`/api/getOptionList?${params.toString()}`);
      if (!response.ok)
        throw new Error(`getOptionList failed: ${response.status}`);

      const data = await response.json();
      const rawHeaders = Array.isArray(data?.headers) ? data.headers : [];
      setHeaders(
        rawHeaders.filter((h: HeaderDef) => !["name", "no"].includes(h.key)),
      );
      setDeviceData(Array.isArray(data?.deviceno) ? data.deviceno : []);
      setSelectedNos(new Set());
      setSearch("");
      setColumnFilters({});
    } catch (error) {
      console.error("fetchOptionList error:", error);
      resetTableState();
    }
  };

  const fetchDname = async () => {
    if (!unitBlock?.block_no) {
      resetTableState();
      return;
    }

    try {
      resetTableState();

      const response = await fetch(
        `/api/getOptionSelect?b=${encodeURIComponent(unitBlock.block_no)}`,
      );
      if (!response.ok)
        throw new Error(`getOptionSelect failed: ${response.status}`);

      const data = await response.json();
      const resItems = Array.isArray(data?.items) ? data.items : [];
      const resLabels = Array.isArray(data?.label) ? data.label : [];

      if (resItems.length === 0) {
        setSelectDefs([]);
        setSelectDname([]);
        await fetchOptionList([]);
        return;
      }

      setSelectDefs(
        resItems.map((itemList: unknown, index: number) => ({
          items: Array.isArray(itemList) ? itemList.map(String) : [],
          label: resLabels[index] || `選択${index + 1}`,
        })),
      );
      setSelectDname(new Array(resItems.length).fill(""));
    } catch (error) {
      console.error("fetchDname error:", error);
      setSelectDefs([]);
      setSelectDname([]);
      resetTableState();
    }
  };

  useEffect(() => {
    if (open) fetchDname();
  }, [open, unitBlock?.block_no]);

  const getUniqueValues = (key: string) => {
    return [...new Set(deviceData.map((item) => normalizeValue(item[key])))]
      .map(String)
      .sort((a, b) => a.localeCompare(b, "ja"));
  };

  const filteredDeviceData = useMemo(() => {
    const keywords = search
      .split(" ")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    return deviceData.filter((item) => {
      const searchMatched = keywords.every((keyword) =>
        Object.values(item).some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(keyword),
        ),
      );

      if (!searchMatched) return false;

      return filterableHeaderKeys.every((key) => {
        const filterValue = columnFilters[key];
        if (!filterValue) return true;
        return normalizeValue(item[key]) === filterValue;
      });
    });
  }, [columnFilters, deviceData, filterableHeaderKeys, search]);

  const selectedItems = useMemo(() => {
    return deviceData.filter((item, index) =>
      selectedNos.has(String(item.no ?? index)),
    );
  }, [deviceData, selectedNos]);

  const toggleSelected = (
    row: KeyValueRecord,
    index: number,
    checked: boolean,
  ) => {
    if (row.selectable === false) return;

    const key = String(row.no ?? index);
    setSelectedNos((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const addOption = () => {
    onAdd(selectedItems);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>オプション追加</DialogTitle>
      <DialogContent dividers>
        {selectDefs.length > 0 && (
          <Stack spacing={2} sx={{ mb: 2 }}>
            <Grid container spacing={2}>
              {selectDefs.map((selectDef, index) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={`select-${index}`}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{selectDef.label}</InputLabel>
                    <Select
                      value={selectDname[index] ?? ""}
                      label={selectDef.label}
                      onChange={(event: SelectChangeEvent) => {
                        const next = [...selectDname];
                        next[index] = event.target.value;
                        setSelectDname(next);
                      }}
                    >
                      <MenuItem value="">
                        <em>未選択</em>
                      </MenuItem>
                      {selectDef.items.map((item) => (
                        <MenuItem value={item} key={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
            </Grid>

            <Box>
              <Button variant="contained" onClick={() => fetchOptionList()}>
                検索
              </Button>
            </Box>
          </Stack>
        )}

        <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
          <Button
            variant="contained"
            onClick={addOption}
            disabled={selectedItems.length === 0}
          >
            オプション追加
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setColumnFilters({})}
            disabled={activeFilterCount === 0}
          >
            列フィルタ解除
          </Button>
          {activeFilterCount > 0 && (
            <Chip label={`列フィルタ ${activeFilterCount}件`} size="small" />
          )}
        </Stack>

        <TextField
          fullWidth
          size="small"
          label="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ mb: 2 }}
        />

        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ maxHeight: 560 }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                {headers.map((header) => (
                  <TableCell
                    key={header.key}
                    sx={{
                      bgcolor: "#3399b3",
                      color: "white",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Typography
                        variant="caption"
                        sx={{ color: "inherit", fontWeight: 700 }}
                      >
                        {header.title ?? header.key}
                      </Typography>
                      <Select
                        size="small"
                        value={columnFilters[header.key] ?? ""}
                        displayEmpty
                        onChange={(event) =>
                          setColumnFilters((prev) => ({
                            ...prev,
                            [header.key]: event.target.value,
                          }))
                        }
                        sx={{ bgcolor: "white", minWidth: 140 }}
                      >
                        <MenuItem value="">すべて</MenuItem>
                        {getUniqueValues(header.key).map((value) => (
                          <MenuItem
                            key={`${header.key}-${value}`}
                            value={value}
                          >
                            {value}
                          </MenuItem>
                        ))}
                      </Select>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDeviceData.map((row, index) => {
                const rowKey = String(row.no ?? index);
                return (
                  <TableRow hover key={rowKey}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedNos.has(rowKey)}
                        disabled={row.selectable === false}
                        onChange={(event) =>
                          toggleSelected(row, index, event.target.checked)
                        }
                      />
                    </TableCell>
                    {headers.map((header) => (
                      <TableCell
                        key={`${rowKey}-${header.key}`}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {formatValue(row[header.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {filteredDeviceData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={headers.length + 1}>
                    <Typography variant="body2" color="text.secondary">
                      表示できるオプションがありません。
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close Dialog</Button>
      </DialogActions>
    </Dialog>
  );
}

type CabinetOptionDialogProps = {
  open: boolean;
  initialData: KeyValueRecord;
  item: KeyValueRecord;
  onClose: () => void;
  onSave: (nextCabOption: KeyValueRecord) => void;
};

export default function CabinetOptionDialog(props: CabinetOptionDialogProps) {
  const { open, initialData, item, onClose, onSave } = props;

  const optionCaption = useMemo(() => item?.optionSelect1 || [], [item]);
  const onceButtonConfig = useMemo(() => item?.optionSelect2 || {}, [item]);
  const optionDict = useMemo(() => item?.OptionDict || {}, [item]);

  const [draft, setDraft] = useState<KeyValueRecord>({ rows: [] });
  const [optionListOpen, setOptionListOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const next = deepClone(initialData || {}) as KeyValueRecord;
    if (!Array.isArray(next.rows)) next.rows = [];
    if (!next.selectedCaption && optionCaption.length > 0)
      next.selectedCaption = optionCaption[0];
    if (!next.selectedOptionPart) next.selectedOptionPart = null;
    setDraft(next);
  }, [initialData, open, optionCaption]);

  const rows = Array.isArray(draft.rows) ? draft.rows : [];
  const selectedCaption = draft.selectedCaption || "";
  const optionPartItems = useMemo(() => {
    const map = onceButtonConfig?.[selectedCaption] || {};
    return Object.keys(map);
  }, [onceButtonConfig, selectedCaption]);
  const selectedOptionPart = draft.selectedOptionPart || "";

  useEffect(() => {
    if (!open) return;
    if (!selectedCaption) return;

    const keys = Object.keys(onceButtonConfig?.[selectedCaption] || {});
    if (!keys.includes(selectedOptionPart)) {
      setDraft((prev) => ({
        ...prev,
        selectedOptionPart: keys[0] || null,
      }));
    }
  }, [onceButtonConfig, open, selectedCaption, selectedOptionPart]);

  const currentOptionKey =
    selectedCaption && selectedOptionPart
      ? `${selectedCaption}-${selectedOptionPart}`
      : "";
  const selectedMaxQuantity = Number(
    onceButtonConfig?.[selectedCaption]?.[selectedOptionPart] || 0,
  );
  const dialogUnitBlock = useMemo(
    () => ({ block_no: currentOptionKey, phase: "" }),
    [currentOptionKey],
  );

  const dynamicFieldKeys = useMemo(() => {
    const managedKeys = new Set([
      "__rowId",
      "name",
      "optionpartscode",
      "Quantity_Pieces",
    ]);
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (managedKeys.has(key)) continue;
        if (!seen.has(key)) {
          seen.add(key);
          ordered.push(key);
        }
      }
    }
    return ordered;
  }, [rows]);

  const getMaxQuantityByName = (name: string) => {
    const [caption, ...rest] = String(name || "").split("-");
    const part = rest.join("-");
    return Number(onceButtonConfig?.[caption]?.[part] || 0);
  };

  const validateRowQuantity = (rowIndex: number, value: string | number) => {
    setDraft((prev) => {
      const nextRows = Array.isArray(prev.rows) ? [...prev.rows] : [];
      const row = { ...(nextRows[rowIndex] || {}) };
      let qty = Number(value || 0);
      if (!Number.isFinite(qty) || qty < 1) qty = 1;

      const max = getMaxQuantityByName(row.name);
      const totalWithoutSelf = nextRows.reduce(
        (sum: number, current: KeyValueRecord, index: number) => {
          if (index === rowIndex) return sum;
          if (current.name !== row.name) return sum;
          return sum + Number(current.Quantity_Pieces || 0);
        },
        0,
      );

      if (max > 0 && totalWithoutSelf + qty > max) {
        qty = Math.max(1, max - totalWithoutSelf);
        window.alert(`「${row.name}」の合計数量は最大 ${max} です。`);
      }

      row.Quantity_Pieces = qty;
      nextRows[rowIndex] = row;
      return { ...prev, rows: nextRows };
    });
  };

  const handleAddOption = (selectedItems: KeyValueRecord[]) => {
    if (!currentOptionKey) {
      window.alert("先に取付位置とオプションを選択してください。");
      return;
    }

    const items = Array.isArray(selectedItems) ? selectedItems : [];
    if (items.length === 0) return;

    setDraft((prev) => {
      const nextRows = Array.isArray(prev.rows) ? [...prev.rows] : [];
      const max = selectedMaxQuantity;
      let runningTotal = nextRows.reduce((sum: number, row: KeyValueRecord) => {
        if (row.name !== currentOptionKey) return sum;
        return sum + Number(row.Quantity_Pieces || 0);
      }, 0);

      for (const src of items) {
        const qty = Math.max(
          1,
          Number(src.Quantity_Pieces || src.quantity || 1),
        );

        if (max > 0 && runningTotal + qty > max) {
          window.alert(
            `「${currentOptionKey}」の合計数量は最大 ${max} です。超過分は追加しません。`,
          );
          continue;
        }

        const newRow: KeyValueRecord = {
          name: currentOptionKey,
          optionpartscode:
            src.optionpartscode ||
            src.OptionPartsCode ||
            src.optionPartsCode ||
            src.partscode ||
            "",
          Quantity_Pieces: qty,
          __rowId: makeRowId(),
        };

        for (const key of Object.keys(src)) {
          if (key === "Quantity_Pieces" || key === "quantity") continue;
          if (
            key === "optionpartscode" ||
            key === "OptionPartsCode" ||
            key === "optionPartsCode" ||
            key === "partscode"
          ) {
            continue;
          }
          newRow[key] = src[key];
        }

        nextRows.push(newRow);
        runningTotal += qty;
      }

      return { ...prev, rows: nextRows };
    });
  };

  const deleteRow = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      rows: (Array.isArray(prev.rows) ? prev.rows : []).filter(
        (_: KeyValueRecord, rowIndex: number) => rowIndex !== index,
      ),
    }));
  };

  const save = () => {
    const next = deepClone(draft) as KeyValueRecord;
    if (!Array.isArray(next.rows)) next.rows = [];
    onSave(next);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>筐体オプション</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>取付位置</InputLabel>
                <Select
                  label="取付位置"
                  value={selectedCaption}
                  onChange={(event: SelectChangeEvent) =>
                    setDraft((prev) => ({
                      ...prev,
                      selectedCaption: event.target.value,
                    }))
                  }
                >
                  {optionCaption.map((caption: string) => (
                    <MenuItem value={caption} key={caption}>
                      {caption}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small" disabled={!selectedCaption}>
                <InputLabel>オプション</InputLabel>
                <Select
                  label="オプション"
                  value={selectedOptionPart}
                  onChange={(event: SelectChangeEvent) =>
                    setDraft((prev) => ({
                      ...prev,
                      selectedOptionPart: event.target.value,
                    }))
                  }
                >
                  {optionPartItems.map((part) => (
                    <MenuItem value={part} key={part}>
                      {part}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => setOptionListOpen(true)}
                  disabled={!currentOptionKey}
                >
                  オプション追加
                </Button>
                {currentOptionKey && (
                  <Typography variant="caption" color="text.secondary">
                    選択中: {currentOptionKey} / 最大数量: {selectedMaxQuantity}
                  </Typography>
                )}
              </Stack>
            </Grid>
          </Grid>

          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              オプションはまだ追加されていません。
            </Typography>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ maxHeight: 560 }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>name</TableCell>
                    <TableCell>optionpartscode</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>数量</TableCell>
                    <TableCell sx={{ width: 70 }}>削除</TableCell>
                    {dynamicFieldKeys.map((key) => (
                      <TableCell key={`head-${key}`}>
                        {optionDict[key] || key}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row: KeyValueRecord, index: number) => (
                    <TableRow key={row.__rowId || index}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {row.name}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {row.optionpartscode}
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={row.Quantity_Pieces ?? 1}
                          type="number"
                          size="small"
                          inputProps={{ min: 1 }}
                          onChange={(event) =>
                            validateRowQuantity(index, event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => deleteRow(index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      {dynamicFieldKeys.map((key) => (
                        <TableCell
                          key={`cell-${index}-${key}`}
                          sx={{ whiteSpace: "nowrap" }}
                        >
                          {formatValue(row[key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>

        <OptionListDialog
          open={optionListOpen}
          unitBlock={dialogUnitBlock}
          onClose={() => setOptionListOpen(false)}
          onAdd={handleAddOption}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={save}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
