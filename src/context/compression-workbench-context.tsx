import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { useCompressionWorker } from '../hooks/useCompressionWorker'
import type {
  AlgorithmId,
  ChartMetric,
  CompressionModifiers,
  CompressionResultRow,
  InputMode,
  PresetEntry,
  ResultSortField,
  RunProgress,
  SortDirection,
} from '../types/compression'
import {
  ALGORITHM_OPTIONS,
  DEFAULT_METRIC,
  DEFAULT_PRESET_ENTRIES,
  buildPresetNotation,
  getAlgorithmOption,
} from '../utils/compression-config'
import { sortCompressionResults } from '../utils/results-sort'
import { CompressionWorkbenchContext, type CompressionWorkbenchContextValue } from './compression-workbench-store'

const textEncoder = new TextEncoder()

interface CompressionWorkbenchProviderProps {
  children: ReactNode
}

export function CompressionWorkbenchProvider({ children }: CompressionWorkbenchProviderProps) {
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState<string>('Enter text or upload a file to benchmark compression strategies.\n\n---' + '\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'.repeat(3))
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [presetEntries, setPresetEntries] = useState<PresetEntry[]>(() => clonePresetEntries(DEFAULT_PRESET_ENTRIES))
  const [metric, setMetric] = useState<ChartMetric>(DEFAULT_METRIC)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const activeRunRef = useRef<{ cancelled: boolean } | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [rows, setRows] = useState<CompressionResultRow[]>([])
  const [sortField, setSortField] = useState<ResultSortField>('ratio')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const { isReady: isWorkerReady, runCompression: runWithWorker, cancelCurrentRun } = useCompressionWorker()

  const originalSize = useMemo(() => {
    if (inputMode === 'file') {
      return selectedFile?.size ?? 0
    }
    return textEncoder.encode(textInput).length
  }, [inputMode, selectedFile, textInput])

  const enabledEntries = useMemo(() => presetEntries.filter((entry) => entry.enabled), [presetEntries])
  const sortedRows = useMemo(() => sortCompressionResults(rows, sortField, sortDirection), [rows, sortDirection, sortField])

  const togglePresetEntryEnabled = useCallback((presetId: string) => {
    setErrorMessage(null)
    setPresetEntries((current) =>
      current.map((entry) => (entry.id === presetId ? { ...entry, enabled: !entry.enabled } : entry)),
    )
  }, [])

  const addPresetEntry = useCallback((algorithm: AlgorithmId, level: number, modifiers: CompressionModifiers) => {
    const option = getAlgorithmOption(algorithm)
    const normalizedLevel = option.supportsLevel
      ? Math.max(option.minLevel, Math.min(option.maxLevel, level))
      : option.defaultLevel

    const nextEntry: PresetEntry = {
      id: `custom-${crypto.randomUUID()}`,
      enabled: true,
      algorithm,
      level: normalizedLevel,
      modifiers: cloneModifiers(modifiers),
      source: 'custom',
    }

    setPresetEntries((current) => [...current, nextEntry])
  }, [])

  const updateSort = useCallback(
    (field: ResultSortField) => {
      if (sortField === field) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
        return
      }

      setSortField(field)
      setSortDirection('asc')
    },
    [sortField],
  )

  const runCompression = useCallback(async () => {
    if (activeRunRef.current) {
      return
    }
    setErrorMessage(null)

    if (!isWorkerReady) {
      setErrorMessage('Compression engine is still loading. Please wait a moment and run again.')
      return
    }

    const run = { cancelled: false }
    activeRunRef.current = run
    setIsRunning(true)
    setProgress(null)

    try {
      const input = await getInputBytes(inputMode, textInput, selectedFile)
      if (run.cancelled) {
        return
      }
      if (input.length === 0) {
        setErrorMessage('Input is empty. Add text or choose a file before running.')
        return
      }

      const jobs = enabledEntries.map((entry) => {
        const option = getAlgorithmOption(entry.algorithm)
        const normalizedLevel = option.supportsLevel
          ? Math.max(option.minLevel, Math.min(option.maxLevel, entry.level))
          : option.defaultLevel

        return {
          presetId: entry.id,
          label: buildPresetNotation(entry.algorithm, normalizedLevel, entry.modifiers),
          algorithm: entry.algorithm,
          level: normalizedLevel,
          modifiers: cloneModifiers(entry.modifiers),
        }
      })

      if (jobs.length === 0) {
        setErrorMessage('Enable at least one preset before running.')
        return
      }

      setRows([])
      setProgress({
        completed: 0,
        total: jobs.length,
        currentLabel: 'Starting...',
      })

      const responseRows = await runWithWorker({
        input,
        jobs,
        onProgress: (nextProgress) => setProgress(nextProgress),
      })

      setRows(responseRows)
      setProgress({
        completed: jobs.length,
        total: jobs.length,
        currentLabel: 'Completed',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Compression execution failed.'
      if (!run.cancelled) {
        setErrorMessage(message)
      }
    } finally {
      activeRunRef.current = null
      setIsRunning(false)
    }
  }, [enabledEntries, inputMode, isWorkerReady, runWithWorker, selectedFile, textInput])

  const cancelCompression = useCallback(() => {
    if (activeRunRef.current) {
      activeRunRef.current.cancelled = true
    }
    cancelCurrentRun()
    setProgress((current) =>
      current
        ? {
            ...current,
            currentLabel: 'Cancelling...',
          }
        : current,
    )
  }, [cancelCurrentRun])

  const value = useMemo<CompressionWorkbenchContextValue>(
    () => ({
      algorithmOptions: ALGORITHM_OPTIONS,
      presetEntries,
      inputMode,
      textInput,
      selectedFileName: selectedFile?.name ?? null,
      originalSize,
      metric,
      isRunning,
      isWorkerReady,
      errorMessage,
      progress,
      results: sortedRows,
      sortField,
      sortDirection,
      setInputMode,
      setTextInput,
      setSelectedFile,
      togglePresetEntryEnabled,
      addPresetEntry,
      setMetric,
      updateSort,
      runCompression,
      cancelCompression,
    }),
    [
      addPresetEntry,
      cancelCompression,
      errorMessage,
      inputMode,
      isRunning,
      isWorkerReady,
      metric,
      originalSize,
      presetEntries,
      progress,
      runCompression,
      selectedFile,
      sortedRows,
      sortDirection,
      sortField,
      textInput,
      togglePresetEntryEnabled,
      updateSort,
    ],
  )

  return <CompressionWorkbenchContext.Provider value={value}>{children}</CompressionWorkbenchContext.Provider>
}

function cloneModifiers(modifiers: CompressionModifiers): CompressionModifiers {
  return {
    base64: modifiers.base64,
    base85: modifiers.base85,
  }
}

function clonePresetEntries(entries: PresetEntry[]): PresetEntry[] {
  return entries.map((entry) => ({
    ...entry,
    modifiers: cloneModifiers(entry.modifiers),
  }))
}

async function getInputBytes(inputMode: InputMode, textInput: string, selectedFile: File | null): Promise<Uint8Array> {
  if (inputMode === 'text') {
    return textEncoder.encode(textInput)
  }

  if (!selectedFile) {
    return new Uint8Array()
  }

  return new Uint8Array(await selectedFile.arrayBuffer())
}
