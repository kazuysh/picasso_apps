import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

type AnyRecord = Record<string, any>;

type LayoutEditDialogProps = {
  open: boolean;
  svgText?: string;
  input: AnyRecord;
  layout: AnyRecord;
  onClose: () => void;
  onInputChange?: (nextInput: AnyRecord) => void;
  onLayoutChange?: (nextLayout: AnyRecord) => void;
};

type DragState = {
  element: SVGGElement;
  idLabel: string;
  unitIndex: string;
  offsetX: number;
  offsetY: number;
};

type LineUpResponse = {
  b?: { url?: string } | string;
  l?: AnyRecord[];
  f?: AnyRecord;
  n?: number;
  h?: number;
};

const DEFAULT_BOX_G = ["150", "150", "150"];
const DEFAULT_BOX_W = ["500", "20", "500", "20", "500", "20"];
const DEFAULT_BOX_GB = "150";
const SVG_HEIGHT = 2600;
const SVG_WIDTH = 2000;

function clone<T>(value: T): T {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function toNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBoxG(value: any): any[] {
  return Array.isArray(value) && value.length >= 3 ? value : DEFAULT_BOX_G;
}

function normalizeBoxW(value: any): any[] {
  return Array.isArray(value) && value.length > 0 ? value : DEFAULT_BOX_W;
}

function makeClassifiedData(boxw: any[]) {
  const cumulative = boxw.map(Number).map(
    (
      (sum) => (value: number) =>
        (sum += value)
    )(0),
  );
  const bounds = [0, ...cumulative.slice(0, -1), 9999];

  return bounds.slice(1).map((num, index) => ({
    classIndex: index,
    classValue: bounds[index],
    lowerBound: bounds[index],
    upperBound: num,
  }));
}

function getClassValue(
  number: number,
  classifiedData: ReturnType<typeof makeClassifiedData>,
) {
  const classItem = classifiedData.find(
    (item) => number >= item.lowerBound && number < item.upperBound,
  );
  return classItem ? classItem.classValue : 0;
}

function extractTranslate(transform: string | null) {
  const match = (transform || "translate(0,0)").match(
    /translate\(([^,]+),\s*([^\)]+)\)/,
  );
  if (!match) return { x: 0, y: 0 };
  return {
    x: Number.parseFloat(match[1]) || 0,
    y: Number.parseFloat(match[2]) || 0,
  };
}

function getSvgPoint(svg: SVGSVGElement, event: MouseEvent | ReactMouseEvent) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: event.clientX, y: event.clientY };
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

function getTopLevelGTarget(
  target: EventTarget | null,
  svg: SVGSVGElement | null,
): SVGGElement | null {
  if (!(target instanceof Element) || !svg) return null;

  let current: Element | null = target;
  while (current && current !== svg) {
    if (
      current.tagName.toLowerCase() === "g" &&
      current.parentNode === svg &&
      current.hasAttribute("id")
    ) {
      return current as SVGGElement;
    }
    current = current.parentElement;
  }

  return null;
}

export default function LayoutEditDialog({
  open,
  layout,
  onClose,
  onLayoutChange,
}: LayoutEditDialogProps) {
  const outerSvgRef = useRef<SVGSVGElement | null>(null);
  const innerSvgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<DragState | null>(null);

  const [editableSvgText, setEditableSvgText] = useState("");
  const [selectLabel1, setSelectLabel1] = useState("");
  const [selectLabel2, setSelectLabel2] = useState("");
  const [position, setPosition] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [liningUp, setLiningUp] = useState(false);
  const [generatingSvg, setGeneratingSvg] = useState(false);

  const boxg = useMemo(() => normalizeBoxG(layout?.boxg), [layout?.boxg]);
  const boxw = useMemo(() => normalizeBoxW(layout?.boxw), [layout?.boxw]);
  const classifiedData = useMemo(() => makeClassifiedData(boxw), [boxw]);
  const boxCode =
    layout?.boxcode ?? layout?.box?.box_key ?? layout?.box?.code ?? "確定";

  const patchLayout = useCallback(
    (patch: AnyRecord) => {
      onLayoutChange?.({ ...(layout || {}), ...patch });
    },
    [layout, onLayoutChange],
  );

  const updateSvgDom = useCallback((nextSvg: string) => {
    const container = outerSvgRef.current;
    if (!container) return;

    container.innerHTML = nextSvg || "";
    const svg = container.querySelector("svg") as SVGSVGElement | null;
    innerSvgRef.current = svg;

    if (!svg) return;

    svg.querySelectorAll("g[id]").forEach((g) => {
      if (g.parentNode === svg) {
        (g as SVGGElement).style.cursor = "move";
      }
    });
  }, []);

  const generateSvgFromCurrentLayout = useCallback(async () => {
    const currentLayout = layout?.layout ?? [];
    if (!Array.isArray(currentLayout) || currentLayout.length === 0) {
      setEditableSvgText("");
      updateSvgDom("");
      return;
    }

    setGeneratingSvg(true);
    setErrorMessage("");

    try {
      const payload = {
        l: currentLayout,
        w: boxw.map(String).join(","),
        g: boxg.map(String).join(","),
        h: String(layout?.boxh ?? layout?.boxH ?? 0),
      };

      // 編集ダイアログでは、配置結果SVG(layout.svg / postBoxSvg4)ではなく、
      // UnitLocation.vue の updateLayoutStore2 と同じ配置編集用SVGを生成して使う。
      const res = await axios.post("/api/postBoxSvg2", payload);
      const nextSvg =
        typeof res.data === "string" ? res.data : (res.data?.svg ?? "");
      setEditableSvgText(nextSvg);
      requestAnimationFrame(() => updateSvgDom(nextSvg));
    } catch (error) {
      console.error("postBoxSvg2 failed", error);
      setEditableSvgText("");
      updateSvgDom("");
      setErrorMessage("配置編集用SVGの生成に失敗しました。");
    } finally {
      setGeneratingSvg(false);
    }
  }, [boxg, boxw, layout?.boxH, layout?.boxh, layout?.layout, updateSvgDom]);

  const updateLineUp = useCallback(
    async (nextLayoutList: AnyRecord[]) => {
      setLiningUp(true);
      setErrorMessage("");
      setInfoMessage("整列配置を実行中です...");

      try {
        const res = await axios.post<LineUpResponse>("/api/postLineUp", {
          b: layout?.backgroundSvgUrl,
          g: boxg,
          gb: layout?.boxgb ?? DEFAULT_BOX_GB,
          l: nextLayoutList,
        });

        const url = res.data?.b;
        const ldata = res.data?.l ?? [];
        const floor = res.data?.f ?? {};
        const nrow = res.data?.n ?? 0;
        const boxH = res.data?.h ?? 9999;

        if (boxH !== 9999 && ldata.length === nextLayoutList.length) {
          const svgPayload = {
            l: ldata,
            w: boxw.map(String).join(","),
            g: boxg.map(String).join(","),
            h: String(layout?.boxh ?? boxH ?? 0),
          };
          const svgRes = await axios.post("/api/postBoxSvg2", svgPayload);
          const nextSvg =
            typeof svgRes.data === "string"
              ? svgRes.data
              : (svgRes.data?.svg ?? "");

          const nextLayout = {
            ...(layout || {}),
            layout: ldata,
            floor,
            nrow,
            boxH,
            backgroundSvgUrl:
              typeof url === "string"
                ? url
                : (url?.url ?? layout?.backgroundSvgUrl),
            svg: nextSvg || layout?.svg || "",
          };
          onLayoutChange?.(nextLayout);
          setInfoMessage("整列配置を反映しました");

          if (nextSvg) {
            setEditableSvgText(nextSvg);
            updateSvgDom(nextSvg);
          }
        } else {
          patchLayout({ layout: nextLayoutList, boxH: 0 });
          setErrorMessage(
            "整列できません。一旦、移動後の座標のみ反映しました。同じ幅でそろえて下さい。",
          );
        }
      } catch (error) {
        console.error("postLineUp failed", error);
        patchLayout({ layout: nextLayoutList });
        setErrorMessage(
          "整列配置APIの呼び出しに失敗しました。移動後の座標のみ反映しました。",
        );
      } finally {
        setLiningUp(false);
      }
    },
    [boxg, boxw, layout, onLayoutChange, patchLayout, updateSvgDom],
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const svg = innerSvgRef.current;
      const g = getTopLevelGTarget(event.target, svg);
      if (!g || !svg) return;

      const [idLabel = "", unitIndex = ""] = (g.getAttribute("id") || "").split(
        "#",
      );
      const canDrag = Array.isArray(layout?.layout)
        ? layout.layout.some(
            (item: AnyRecord) => String(item.i) === String(unitIndex),
          )
        : false;

      if (!idLabel || !unitIndex || !canDrag) return;

      event.preventDefault();
      setSelectLabel1(idLabel);
      setSelectLabel2(unitIndex);

      const currentPoint = getSvgPoint(svg, event);
      const translate = extractTranslate(g.getAttribute("transform"));
      draggingRef.current = {
        element: g,
        idLabel,
        unitIndex,
        offsetX: currentPoint.x - translate.x,
        offsetY: currentPoint.y - translate.y,
      };
    },
    [layout?.layout],
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      const drag = draggingRef.current;
      const svg = innerSvgRef.current;
      if (!drag || !svg) return;

      const point = getSvgPoint(svg, event);
      const x = point.x - drag.offsetX;
      const y = point.y - drag.offsetY;
      drag.element.setAttribute("transform", `translate(${x}, ${y})`);
      setPosition(`(${Math.round(x)},${Math.round(y)})`);
    },
    [],
  );

  const handleMouseUp = useCallback(
    async (event: ReactMouseEvent<SVGSVGElement>) => {
      const drag = draggingRef.current;
      const svg = innerSvgRef.current;
      if (!drag || !svg) return;

      const point = getSvgPoint(svg, event);
      let x = point.x - drag.offsetX;
      let y = point.y - drag.offsetY;

      if (x < 0) x = 0;
      x = getClassValue(x, classifiedData);
      if (y < toNumber(boxg[1], 150)) y = toNumber(boxg[1], 150);

      drag.element.setAttribute("transform", `translate(${x}, ${y})`);
      setPosition(`(${Math.round(x)},${Math.round(y)})`);
      draggingRef.current = null;

      const nextLayoutList = clone(layout?.layout ?? []).map(
        (item: AnyRecord) => {
          if (String(item.i) === String(drag.unitIndex)) {
            return { ...item, x, y };
          }
          return item;
        },
      );

      patchLayout({ layout: nextLayoutList });
      await updateLineUp(nextLayoutList);
    },
    [boxg, classifiedData, layout?.layout, patchLayout, updateLineUp],
  );

  const handleRightClick = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      event.preventDefault();
      const g = getTopLevelGTarget(event.target, innerSvgRef.current);
      if (g) window.alert(`ID: ${g.id}`);
    },
    [],
  );

  const handleDummyButton = useCallback((label: string) => {
    setInfoMessage(
      `${label} は現在ダミーです。後続工程で設定画面を接続できます。`,
    );
  }, []);

  const handleConfirmDummy = useCallback(() => {
    setInfoMessage(
      "確定ボタンは現在ダミーです。編集内容はドラッグドロップ時にストアへ反映しています。",
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    setErrorMessage("");
    setInfoMessage("");
    setEditableSvgText("");
    updateSvgDom("");
    generateSvgFromCurrentLayout();
  }, [generateSvgFromCurrentLayout, open, updateSvgDom]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>配置編集</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <Button
              variant="outlined"
              onClick={() => handleDummyButton("BOX設定ボタン")}
            >
              BOX設定
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleDummyButton("ユニットガター編集ボタン")}
            >
              ユニットガター編集
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleDummyButton("箱選定ボタン")}
            >
              箱選定
            </Button>
            <Button variant="contained" onClick={handleConfirmDummy}>
              {boxCode}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {selectLabel1} {selectLabel2} {position}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Typography variant="body2">
              高さ: {layout?.boxH ?? layout?.boxh ?? ""}
            </Typography>
            <Typography variant="body2">
              列幅: {JSON.stringify(layout?.floor ?? {})}
            </Typography>
            <Typography variant="body2">
              ULF: {JSON.stringify(layout?.ulf ?? {})}
            </Typography>
          </Stack>

          {infoMessage && <Alert severity="info">{infoMessage}</Alert>}
          {errorMessage && <Alert severity="warning">{errorMessage}</Alert>}
          {liningUp && <Alert severity="info">整列配置を実行中です。</Alert>}
          {generatingSvg && (
            <Alert severity="info">配置編集用SVGを生成中です。</Alert>
          )}

          <Divider />

          <Paper
            variant="outlined"
            sx={{
              p: 1,
              height: 720,
              overflow: "auto",
              bgcolor: "#fafafa",
            }}
          >
            {editableSvgText ? (
              <Box sx={{ width: SVG_WIDTH, height: SVG_HEIGHT }}>
                <svg
                  ref={outerSvgRef}
                  width={SVG_WIDTH}
                  height={SVG_HEIGHT}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={handleRightClick}
                  style={{
                    border: "15px solid #00ff00",
                    transform: "scale(0.6)",
                    transformOrigin: "top left",
                  }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  height: 360,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography color="text.secondary">
                  配置編集用SVGデータがありません
                </Typography>
              </Box>
            )}
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
