import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AnyRecord = Record<string, any>

export type UnitItem = {
  id: number | string
  unit_no?: string
  unit_key?: string
  unitNo?: string
  key?: string
  uid?: string
  name?: string
  i_row?: number | null
  list_w?: number[] | string[] | null
  list_d?: number[] | string[] | null
  [key: string]: any
}

export type DeviceInnerItem = {
  Name?: string
  X?: number
  Y?: number
  W?: number
  H?: number
  [key: string]: any
}

export type DeviceBlockItem = {
  id?: number | string
  unit_i?: number | string
  i?: number | string
  unitNo?: string
  unit_no?: string
  unit_key?: string
  unit?: string
  block?: string | number | null
  block_no?: string | number | null
  node?: string
  node_type?: string
  type?: string
  path_no?: number | string
  path?: number | string
  route?: number | string
  devices?: DeviceInnerItem[]
  [key: string]: any
}

export type GraphNode = {
  id: string
  label: string
}

export type GraphEdge = {
  from: string
  to: string
}

export type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type LayoutItem = {
  u?: string
  k?: string
  unit_no?: string
  unit_key?: string
  i: number
  c?: number
  x?: number
  y?: number
  w?: number
  h?: number
  gtop?: number
  gbottom?: number
  list_w?: number[]
  list_d?: number[]
  [key: string]: any
}

export type GenerationStartStep = 'full' | 'initialPlacement' | 'lineUp'

export type AppState = {
  generationStartStep: GenerationStartStep
  input: {
    basic: AnyRecord
    cabinfo: AnyRecord
    caboption: AnyRecord
    unit: {
      currentID: number
      list: UnitItem[]
      newflag: number
    }
    circuit: AnyRecord & {
      graphdata?: GraphData
      saveflg?: string
      threshold?: number
    }
    device: {
      list: DeviceBlockItem[]
    }
  }
  output: {
    box: AnyRecord
  }
  workblock: {
    block: AnyRecord
  }
  layout: {
    floor: AnyRecord
    layout: LayoutItem[]
    ulf?: Record<string, any>
    box?: AnyRecord
    boxw?: Array<number | string>
    boxg?: Array<number | string>
    boxgb?: number | string
    boxh?: number | string
    boxH?: number | string
    nrow?: number
    backgroundSvgUrl?: string
    svg?: string
    [key: string]: any
  }
}

type Actions = {
  updateInputData: (data: AppState['input']) => void
  replaceAll: (data: AppState) => void
  setGenerationStartStep: (step: GenerationStartStep) => void

  setCircuitGraphData: (graphdata: GraphData) => void
  applyCircuitGraphDataEdit: (graphdata: GraphData) => void
  setCircuitSaveFlag: (saveflg: string) => void

  setLayoutUlf: (ulf: Record<string, any>) => void
  setLayoutLayout: (layoutData: LayoutItem[]) => void
  setLayoutFloor: (floor: AnyRecord) => void
  setLayoutField: <K extends keyof AppState['layout']>(key: K, value: AppState['layout'][K]) => void
  applyLayoutDataEdit: (layoutData: Partial<AppState['layout']>) => void

  setUnitList: (list: UnitItem[]) => void
  setUnitNewFlag: (flag: number) => void

  appendLogSafeData?: () => void
}

export type AppStore = AppState & Actions

const initialState: AppState = {
  generationStartStep: 'full',
  input: {
    basic: {},
    cabinfo: {},
    caboption: {},
    unit: { currentID: 10000, list: [], newflag: 0 },
    circuit: {},
    device: { list: [] },
  },
  output: { box: {} },
  workblock: { block: {} },
  layout: {
    floor: {},
    layout: [],
    ulf: {},
    box: {},
    boxw: ['500', '20', '500', '20', '500', '20'],
    boxg: [],
    boxgb: 0,
    boxh: 0,
    boxH: 0,
    nrow: 0,
    backgroundSvgUrl: '',
    svg: '',
  },
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...initialState,

  updateInputData: (newData) =>
    set((state) => ({
      ...state,
      input: newData,
    })),

  replaceAll: (data) =>
    set(() => ({
      ...data,
      generationStartStep: 'full',
    })),

  setGenerationStartStep: (step) =>
    set((state) => ({
      ...state,
      generationStartStep: step,
    })),

  setCircuitGraphData: (graphdata) =>
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        circuit: {
          ...state.input.circuit,
          graphdata,
        },
      },
    })),

  applyCircuitGraphDataEdit: (graphdata) =>
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        circuit: {
          ...state.input.circuit,
          graphdata,
          saveflg: '0',
        },
        unit: {
          ...state.input.unit,
          newflag: 1,
          list: state.input.unit.list.map((unit) => ({
            ...unit,
            i_row: 1,
          })),
        },
      },
      layout: {
        ...state.layout,
        floor: {},
        layout: [],
        ulf: {},
        box: {},
        boxcode: '',
        boxH: 0,
        nrow: 0,
        backgroundSvgUrl: '',
        svg: '',
      },
      generationStartStep: 'initialPlacement',
    })),

  setCircuitSaveFlag: (saveflg) =>
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        circuit: {
          ...state.input.circuit,
          saveflg,
        },
      },
    })),

  setLayoutUlf: (ulf) =>
    set((state) => ({
      ...state,
      layout: {
        ...state.layout,
        ulf,
      },
    })),

  setLayoutLayout: (layoutData) =>
    set((state) => ({
      ...state,
      layout: {
        ...state.layout,
        layout: layoutData,
      },
    })),

  setLayoutFloor: (floor) =>
    set((state) => ({
      ...state,
      layout: {
        ...state.layout,
        floor,
      },
    })),

  setLayoutField: (key, value) =>
    set((state) => ({
      ...state,
      layout: {
        ...state.layout,
        [key]: value,
      },
    })),

  applyLayoutDataEdit: (layoutData) =>
    set((state) => {
      const nextLayout = {
        ...state.layout,
        ...layoutData,
      }
      const layoutList = Array.isArray(nextLayout.layout) ? nextLayout.layout : []
      const rowByUnitId = new Map<string, number>()

      layoutList.forEach((item) => {
        const rawUnitId = item.i ?? item.id
        const rawRow = item.c ?? item.row ?? item.i_row
        const row = Number(rawRow)

        if (rawUnitId != null && Number.isFinite(row)) {
          rowByUnitId.set(String(rawUnitId), row)
        }
      })

      const hasStableLayout = Number(nextLayout.boxH ?? 0) > 0

      return {
        ...state,
        input: {
          ...state.input,
          unit: {
            ...state.input.unit,
            newflag: hasStableLayout ? 0 : 1,
            list: state.input.unit.list.map((unit) => {
              const row = rowByUnitId.get(String(unit.id))

              if (row == null) return unit

              return {
                ...unit,
                i_row: row,
              }
            }),
          },
        },
        layout: nextLayout,
        generationStartStep: 'lineUp',
      }
    }),

  setUnitList: (list) =>
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        unit: {
          ...state.input.unit,
          list,
        },
      },
    })),

  setUnitNewFlag: (flag) =>
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        unit: {
          ...state.input.unit,
          newflag: flag,
        },
      },
    })),
    }),
    {
      name: 'pback-app-store',
      partialize: (state) => ({
        generationStartStep: state.generationStartStep,
        input: state.input,
        output: state.output,
        workblock: state.workblock,
        layout: state.layout,
      }),
    },
  ),
)
