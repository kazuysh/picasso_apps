import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useAppStore, type AnyRecord } from "../../stores/useAppStore";
import BlockListDialog from "./BlockListDialog";
import CircuitEditDialog from "./CircuitEditDialog";
import UnitAddDialog from "./UnitAddDialog";

type CircuitDesignTabProps = {
  graphdata?: any;
  fieldLabelDict?: Record<string, string>;
  onGraphdataChange?: (nextGraphdata: any) => void;
};

type MermaidNodeClickInfo = {
  originalNodeId: string;
  deviceBlockKey: string;
  node: any;
};

type MermaidViewProps = {
  graphdata?: any;
  zoom: number;
  onNodeClick?: (info: MermaidNodeClickInfo) => void;
};

type NodeClickMeta = {
  originalNodeId: string;
  deviceBlockKey: string;
  node: any;
};

type EdgeLike = {
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  src?: string;
  dst?: string;
  [key: string]: any;
};

function sanitizeMermaidId(value: unknown) {
  const text = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_");
  return text || "EMPTY_NODE";
}

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function getNodeId(node: any) {
  return normalize(
    node?.id ?? node?.Unit_No ?? node?.unit_no ?? node?.UnitNo ?? node?.name,
  );
}

function getNodeLabel(node: any) {
  return normalize(
    node?.label ??
      node?.Label ??
      node?.Unit_No ??
      node?.unit_no ??
      node?.id ??
      node?.name,
  );
}

function isInputOutputNode(node: AnyRecord) {
  const id = getNodeId(node);
  const label = getNodeLabel(node);
  const typeCandidates = [
    node?.node_type,
    node?.nodeType,
    node?.type,
    node?.node,
    node?.data?.node_type,
    node?.data?.nodeType,
    node?.data?.type,
    node?.data?.node,
  ]
    .map((value) => normalize(value).toLowerCase())
    .filter(Boolean);

  const inputOutputTypes = new Set([
    "in",
    "out",
    "input",
    "output",
    "source",
    "sink",
    "terminal_input",
    "terminal_output",
    "入力",
    "出力",
  ]);

  if (typeCandidates.some((value) => inputOutputTypes.has(value))) {
    return true;
  }

  return (
    /^IN(?:[#_-]|$)/i.test(id) ||
    /^OUT(?:[#_-]|$)/i.test(id) ||
    /^入力(?:\d+|[#_-].*)?$/.test(label) ||
    /^出力(?:\d+|[#_-].*)?$/.test(label)
  );
}

function getEdgeFrom(edge: EdgeLike) {
  return normalize(edge?.from ?? edge?.source ?? edge?.src ?? edge?.v);
}

function getEdgeTo(edge: EdgeLike) {
  return normalize(edge?.to ?? edge?.target ?? edge?.dst ?? edge?.w);
}

function normalizeGraphdata(graphdata: any) {
  const nodes = Array.isArray(graphdata?.nodes)
    ? graphdata.nodes
    : Array.isArray(graphdata?.node)
      ? graphdata.node
      : [];

  const edges = Array.isArray(graphdata?.edges)
    ? graphdata.edges
    : Array.isArray(graphdata?.edge)
      ? graphdata.edge
      : [];

  return { nodes, edges };
}

function getSuffixAfterAt(value: unknown) {
  const text = normalize(value);
  if (!text.includes("@")) return "";
  return text.split("@").pop() || "";
}

function resolveDeviceBlockKeyFromNode(node: any) {
  // 機器ブロック一覧の items[].id と照合するためのキー。
  // まず明示的なキーを優先し、なければ UPN10_10_1@10001 の @ 以降を使う。
  const explicitCandidates = [
    node?.deviceBlockId,
    node?.device_block_id,
    node?.deviceId,
    node?.device_id,
    node?.blockListId,
    node?.block_list_id,
    node?.itemId,
    node?.item_id,
    node?.data?.deviceBlockId,
    node?.data?.device_block_id,
    node?.data?.deviceId,
    node?.data?.device_id,
    node?.data?.blockListId,
    node?.data?.block_list_id,
    node?.data?.itemId,
    node?.data?.item_id,
  ]
    .map(normalize)
    .find(Boolean);

  if (explicitCandidates) return explicitCandidates;

  const suffix = getSuffixAfterAt(getNodeId(node));
  if (suffix) return suffix;

  return getNodeId(node);
}

function getMermaidNodeIdFromDomId(rawDomId: string) {
  // Mermaid の g.node id は以下のような形式になることがあります。
  //   flowchart-IN_1-4
  //   mermaid-1779657374877-flowchart-IN_1-4
  // 末尾の -4 は Mermaid が付ける内部連番なので除去し、
  // flowchart- より後ろのノードIDだけを取り出します。
  const withoutTrailingIndex = rawDomId.replace(/-\d+$/, "");
  const marker = "-flowchart-";

  if (withoutTrailingIndex.includes(marker)) {
    return withoutTrailingIndex.split(marker).pop() || "";
  }

  return withoutTrailingIndex.replace(/^flowchart-/, "");
}

function MermaidView({ graphdata, zoom, onNodeClick }: MermaidViewProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const renderSeqRef = useRef(0);
  const normalizedGraphdata = useMemo(
    () => normalizeGraphdata(graphdata),
    [graphdata],
  );

  const nodeClickMetaMap = useMemo(() => {
    const map = new Map<string, NodeClickMeta>();

    console.log(
      "[CircuitDesignTab][nodeClickMetaMap] nodes =",
      normalizedGraphdata.nodes,
    );

    for (const node of normalizedGraphdata.nodes) {
      const originalNodeId = getNodeId(node);
      if (!originalNodeId) continue;
      const sanitizedId = sanitizeMermaidId(originalNodeId);
      const deviceBlockKey = resolveDeviceBlockKeyFromNode(node);

      map.set(sanitizedId, {
        originalNodeId,
        deviceBlockKey,
        node,
      });
    }

    return map;
  }, [normalizedGraphdata]);

  const mermaidText = useMemo(() => {
    if (!normalizedGraphdata.nodes.length) {
      console.log("[CircuitDesignTab][mermaidText] no nodes", { graphdata });
      return "flowchart TD\nA[データなし]";
    }

    const lines: string[] = ["flowchart TD"];

    for (const node of normalizedGraphdata.nodes) {
      const originalId = getNodeId(node);
      if (!originalId) continue;
      const id = sanitizeMermaidId(originalId);
      const deviceBlockKey = resolveDeviceBlockKeyFromNode(node);
      const baseLabel = String(getNodeLabel(node) || originalId)
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "<br/>");
      const debugKeyLabel = deviceBlockKey
        ? `<br/><small>key:${deviceBlockKey}</small>`
        : "";

      lines.push(`${id}["${baseLabel}${debugKeyLabel}"]`);
    }

    for (const edge of normalizedGraphdata.edges || []) {
      const from = sanitizeMermaidId(getEdgeFrom(edge));
      const to = sanitizeMermaidId(getEdgeTo(edge));
      if (from && to) lines.push(`${from} --> ${to}`);
    }

    const text = lines.join("\n");
    console.log("[CircuitDesignTab][mermaidText]\n" + text);
    return text;
  }, [normalizedGraphdata, graphdata]);

  useEffect(() => {
    console.log("[CircuitDesignTab][useEffect] render start", {
      hasRef: !!ref.current,
      nodeCount: normalizedGraphdata.nodes.length,
      edgeCount: normalizedGraphdata.edges.length,
      hasOnNodeClick: typeof onNodeClick === "function",
      zoom,
    });

    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });

    const seq = ++renderSeqRef.current;

    const render = async () => {
      if (!ref.current) {
        console.warn("[CircuitDesignTab][render] ref.current is null");
        return;
      }

      try {
        const id = `mermaid-${Date.now()}-${seq}`;
        const result = await mermaid.render(id, mermaidText);

        if (!ref.current || seq !== renderSeqRef.current) return;

        ref.current.innerHTML = result.svg;

        const svgRoot = ref.current.querySelector("svg");
        if (!svgRoot) {
          console.warn("[CircuitDesignTab][render] svg not found");
          return;
        }

        // 親要素の幅に強制フィットさせると、縮小しても表示幅より小さくなりません。
        // Mermaid が出力する viewBox の実寸を基準にし、外側 Box の CSS zoom で拡大縮小します。
        const viewBox = svgRoot.getAttribute("viewBox");
        const viewBoxParts = viewBox
          ?.split(/\s+/)
          .map((part) => Number(part))
          .filter((part) => Number.isFinite(part));
        const baseWidth = viewBoxParts?.[2];
        const baseHeight = viewBoxParts?.[3];

        svgRoot.removeAttribute("width");
        svgRoot.removeAttribute("height");
        svgRoot.style.width = baseWidth ? `${baseWidth}px` : "max-content";
        svgRoot.style.maxWidth = "none";
        svgRoot.style.minWidth = "0";
        svgRoot.style.height = baseHeight ? `${baseHeight}px` : "auto";
        svgRoot.style.display = "block";

        const nodeElements = svgRoot.querySelectorAll<SVGGElement>("g.node");
        console.log(
          "[CircuitDesignTab][render] g.node count =",
          nodeElements.length,
        );

        nodeElements.forEach((nodeEl, index) => {
          const rawDomId = nodeEl.id;
          const mermaidNodeId = getMermaidNodeIdFromDomId(rawDomId);
          const clickMeta = nodeClickMetaMap.get(mermaidNodeId);

          if (!clickMeta) {
            console.warn(
              "[CircuitDesignTab][bindNode] clickMeta not found in nodeClickMetaMap",
              {
                index,
                rawDomId,
                mermaidNodeId,
                mapEntries: Array.from(nodeClickMetaMap.entries()),
              },
            );
            return;
          }

          nodeEl.dataset.originalNodeId = clickMeta.originalNodeId;
          nodeEl.dataset.deviceBlockKey = clickMeta.deviceBlockKey;

          if (isInputOutputNode(clickMeta.node)) {
            nodeEl.style.cursor = "default";
            return;
          }

          nodeEl.style.cursor = "pointer";
          nodeEl.setAttribute("role", "button");
          nodeEl.setAttribute("tabindex", "0");

          nodeEl.addEventListener("click", (event) => {
            event.stopPropagation();
            onNodeClick?.(clickMeta);
          });

          nodeEl.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onNodeClick?.(clickMeta);
            }
          });
        });
      } catch (error) {
        console.error("[CircuitDesignTab][render] error", error);
        if (ref.current) {
          ref.current.innerHTML = `<pre style="color:red; white-space:pre-wrap;">${String(error)}</pre>`;
        }
      }
    };

    render();
  }, [mermaidText, nodeClickMetaMap, onNodeClick, normalizedGraphdata, zoom]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        minHeight: 420,
        overflow: "auto",
        bgcolor: "#fafafa",
      }}
    >
      <Box
        ref={ref}
        sx={{
          minHeight: 380,
          minWidth: 0,
          width: "fit-content",
          maxWidth: "none",
          zoom,
        }}
      />
    </Paper>
  );
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const ZOOM_INITIAL = 1.0;

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

function formatZoomPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getGraphNodeIdFromUnit(unit: AnyRecord) {
  const unitNo = normalize(unit?.unit_no ?? unit?.unitNo ?? unit?.name ?? unit?.u);
  const unitId = normalize(unit?.id ?? unit?.unit_i ?? unit?.i);

  if (!unitNo) return "";
  return unitId ? `${unitNo}@${unitId}` : unitNo;
}

function appendUnitsToGraphdata(graphdata: unknown, units: AnyRecord[]) {
  const normalized = normalizeGraphdata(graphdata);
  const nextNodes = [...normalized.nodes];
  const existingNodeIds = new Set(nextNodes.map(getNodeId).filter(Boolean));

  for (const unit of units) {
    const nodeId = getGraphNodeIdFromUnit(unit);
    if (!nodeId || existingNodeIds.has(nodeId)) continue;

    const label = normalize(unit?.unit_no ?? unit?.unitNo ?? unit?.name ?? nodeId);
    nextNodes.push({
      id: nodeId,
      label,
      unit_no: label,
      unit_key: unit?.unit_key,
    });
    existingNodeIds.add(nodeId);
  }

  const nextGraphdata = {
    ...(graphdata || {}),
    nodes: nextNodes,
    edges: normalized.edges,
    node: nextNodes,
    edge: normalized.edges,
  };

  return nextGraphdata;
}

function appendRouteToGraphdata(graphdata: unknown) {
  const normalized = normalizeGraphdata(graphdata);
  const routeNumbers = new Set<number>();

  for (const node of normalized.nodes) {
    const match = getNodeId(node).match(/^(?:IN|OUT)#(\d+)$/i);
    if (!match) continue;

    const routeNumber = Number(match[1]);
    if (Number.isSafeInteger(routeNumber) && routeNumber > 0) {
      routeNumbers.add(routeNumber);
    }
  }

  let nextRouteNumber = routeNumbers.size + 1;
  while (routeNumbers.has(nextRouteNumber)) {
    nextRouteNumber += 1;
  }

  const nextNodes = [
    ...normalized.nodes,
    {
      id: `IN#${nextRouteNumber}`,
      label: `入力#${nextRouteNumber}`,
      node_type: "in",
    },
    {
      id: `OUT#${nextRouteNumber}`,
      label: `出力#${nextRouteNumber}`,
      node_type: "out",
    },
  ];

  return {
    ...(graphdata || {}),
    nodes: nextNodes,
    edges: normalized.edges,
    node: nextNodes,
    edge: normalized.edges,
  };
}

function removeUnusedRoutesFromGraphdata(graphdata: unknown) {
  const normalized = normalizeGraphdata(graphdata);
  const connectedNodeIds = new Set<string>();

  for (const edge of normalized.edges) {
    const from = getEdgeFrom(edge);
    const to = getEdgeTo(edge);
    if (from) connectedNodeIds.add(from);
    if (to) connectedNodeIds.add(to);
  }

  const nextNodes = normalized.nodes.filter((node: AnyRecord) => {
    const nodeId = getNodeId(node);
    const isRouteNode = /^(?:IN|OUT)#\d+$/i.test(nodeId);
    return !isRouteNode || connectedNodeIds.has(nodeId);
  });

  return {
    ...(graphdata || {}),
    nodes: nextNodes,
    edges: normalized.edges,
    node: nextNodes,
    edge: normalized.edges,
  };
}

function removeUnitFromGraphdata(graphdata: unknown, nodeId: string) {
  const normalized = normalizeGraphdata(graphdata);
  const removeId = normalize(nodeId);
  const nextNodes = normalized.nodes.filter((node: AnyRecord) => getNodeId(node) !== removeId);
  const nextEdges = normalized.edges.filter((edge: EdgeLike) => {
    const from = getEdgeFrom(edge);
    const to = getEdgeTo(edge);
    return from !== removeId && to !== removeId;
  });

  return {
    ...(graphdata || {}),
    nodes: nextNodes,
    edges: nextEdges,
    node: nextNodes,
    edge: nextEdges,
  };
}

export default function CircuitDesignTab({
  graphdata,
  fieldLabelDict,
  onGraphdataChange,
}: CircuitDesignTabProps) {
  const devices = useAppStore((state) => state.input?.device?.list || []);
  const [blockListDialogOpen, setBlockListDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [unitAddDialogOpen, setUnitAddDialogOpen] = useState(false);
  const [selectedOriginalNodeId, setSelectedOriginalNodeId] =
    useState<string>("");
  const [selectedDeviceBlockKey, setSelectedDeviceBlockKey] =
    useState<string>("");
  const [zoom, setZoom] = useState(ZOOM_INITIAL);

  const normalizedGraphdata = useMemo(
    () => normalizeGraphdata(graphdata),
    [graphdata],
  );

  console.log("[CircuitDesignTab][component render]", {
    graphdata,
    normalizedNodeCount: normalizedGraphdata.nodes.length,
    normalizedEdgeCount: normalizedGraphdata.edges.length,
    deviceCount: devices.length,
    blockListDialogOpen,
    editDialogOpen,
    unitAddDialogOpen,
    selectedOriginalNodeId,
    selectedDeviceBlockKey,
    zoom,
    sampleDeviceIds: devices.slice(0, 10).map((item) => item?.id),
  });

  const handleNodeClick = (info: MermaidNodeClickInfo) => {
    if (isInputOutputNode(info.node)) return;

    setSelectedOriginalNodeId(info.originalNodeId);
    setSelectedDeviceBlockKey(info.deviceBlockKey);
    setBlockListDialogOpen(true);
  };

  const handleZoomOut = () => {
    setZoom((current) => clampZoom(current - ZOOM_STEP));
  };

  const handleZoomIn = () => {
    setZoom((current) => clampZoom(current + ZOOM_STEP));
  };

  const handleZoomReset = () => {
    setZoom(ZOOM_INITIAL);
  };

  const handleUnitsAdded = (units: AnyRecord[]) => {
    if (!onGraphdataChange || units.length === 0) return;
    onGraphdataChange(appendUnitsToGraphdata(graphdata, units));
  };

  const handleRouteAdded = () => {
    onGraphdataChange?.(appendRouteToGraphdata(graphdata));
  };

  const handleUnusedRoutesRemoved = () => {
    onGraphdataChange?.(removeUnusedRoutesFromGraphdata(graphdata));
  };

  const handleDeleteSelectedUnit = () => {
    const nodeId = normalize(selectedOriginalNodeId);
    const unitInstanceId = normalize(selectedDeviceBlockKey || getSuffixAfterAt(nodeId));
    if (!nodeId) return;

    useAppStore.setState((state) => ({
      ...state,
      input: {
        ...state.input,
        unit: {
          ...state.input.unit,
          list: (state.input.unit.list ?? []).filter(
            (unit) => normalize(unit.id) !== unitInstanceId,
          ),
          newflag: 1,
        },
        device: {
          ...state.input.device,
          list: (state.input.device.list ?? []).filter(
            (device) => normalize(device.id) !== unitInstanceId,
          ),
        },
      },
    }));

    onGraphdataChange?.(removeUnitFromGraphdata(graphdata, nodeId));
    setBlockListDialogOpen(false);
    setSelectedOriginalNodeId("");
    setSelectedDeviceBlockKey("");
  };

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6">回路編集</Typography>
          <Tooltip title="回路結合を編集">
            <IconButton
              size="small"
              aria-label="回路結合を編集"
              onClick={() => setEditDialogOpen(true)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => setUnitAddDialogOpen(true)}
          >
            ユニット追加
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon fontSize="small" />}
            onClick={handleRouteAdded}
          >
            経路追加
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            startIcon={<RemoveIcon fontSize="small" />}
            onClick={handleUnusedRoutesRemoved}
          >
            未使用経路
          </Button>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" color="text.secondary">
            表示倍率: {formatZoomPercent(zoom)}
          </Typography>
          <Tooltip title="縮小">
            <span>
              <IconButton
                size="small"
                aria-label="回路図を縮小"
                onClick={handleZoomOut}
                disabled={zoom <= ZOOM_MIN}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="拡大">
            <span>
              <IconButton
                size="small"
                aria-label="回路図を拡大"
                onClick={handleZoomIn}
                disabled={zoom >= ZOOM_MAX}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAltIcon fontSize="small" />}
            onClick={handleZoomReset}
          >
            Reset
          </Button>
        </Stack>
      </Stack>

      <MermaidView
        graphdata={graphdata}
        zoom={zoom}
        onNodeClick={handleNodeClick}
      />

      <BlockListDialog
        open={blockListDialogOpen}
        circuitBlockId={selectedOriginalNodeId}
        deviceBlockKey={selectedDeviceBlockKey}
        items={devices}
        fieldLabelDict={fieldLabelDict}
        onClose={() => setBlockListDialogOpen(false)}
        onDeleteUnit={handleDeleteSelectedUnit}
      />

      <CircuitEditDialog
        open={editDialogOpen}
        graphdata={graphdata}
        onClose={() => setEditDialogOpen(false)}
        onChange={onGraphdataChange}
      />

      <UnitAddDialog
        open={unitAddDialogOpen}
        onClose={() => setUnitAddDialogOpen(false)}
        onUnitsAdded={handleUnitsAdded}
      />
    </>
  );
}
