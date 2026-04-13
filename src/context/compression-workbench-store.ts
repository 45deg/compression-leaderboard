import { createContext } from 'react'

import type {
  AlgorithmId,
  ChartMetric,
  CompressionAlgorithmOption,
  CompressionModifiers,
  CompressionResultRow,
  InputMode,
  PresetEntry,
  ResultSortField,
  RunProgress,
  SortDirection,
} from '../types/compression'

export interface CompressionWorkbenchContextValue {
  algorithmOptions: CompressionAlgorithmOption[]
  presetEntries: PresetEntry[]
  inputMode: InputMode
  textInput: string
  selectedFileName: string | null
  originalSize: number
  metric: ChartMetric
  isRunning: boolean
  isWorkerReady: boolean
  errorMessage: string | null
  progress: RunProgress | null
  results: CompressionResultRow[]
  sortField: ResultSortField
  sortDirection: SortDirection
  setInputMode: (mode: InputMode) => void
  setTextInput: (value: string) => void
  setSelectedFile: (file: File | null) => void
  togglePresetEntryEnabled: (presetId: string) => void
  addPresetEntry: (algorithm: AlgorithmId, level: number, modifiers: CompressionModifiers) => void
  setMetric: (metric: ChartMetric) => void
  updateSort: (field: ResultSortField) => void
  runCompression: () => Promise<void>
  cancelCompression: () => void
}

export const CompressionWorkbenchContext = createContext<CompressionWorkbenchContextValue | null>(null)
