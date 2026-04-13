import { ListChecks, Plus } from 'lucide-react'
import { useCallback, useMemo, useState, type ChangeEvent } from 'react'

import { useCompressionWorkbench } from '../../context/use-compression-workbench'
import type { AlgorithmId } from '../../types/compression'
import { buildPresetNotation, getAlgorithmOption } from '../../utils/compression-config'

export function AlgorithmSelectionCard() {
  const { algorithmOptions, presetEntries, togglePresetEntryEnabled, addPresetEntry } = useCompressionWorkbench()

  const [addFormOpen, setAddFormOpen] = useState(false)
  const [draftAlgorithm, setDraftAlgorithm] = useState<AlgorithmId>('gzip')
  const [draftLevel, setDraftLevel] = useState<number>(6)
  const [draftBase64, setDraftBase64] = useState(false)
  const [draftBase85, setDraftBase85] = useState(false)

  const selectedCount = useMemo(() => presetEntries.filter((entry) => entry.enabled).length, [presetEntries])
  const draftOption = useMemo(() => getAlgorithmOption(draftAlgorithm), [draftAlgorithm])
  const algorithmOptionItems = useMemo(
    () =>
      algorithmOptions.map((option) => (
        <option key={option.algorithm} value={option.algorithm}>
          {option.label}
        </option>
      )),
    [algorithmOptions],
  )

  const handlePresetToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const presetId = event.currentTarget.dataset.presetId
      if (!presetId) {
        return
      }
      togglePresetEntryEnabled(presetId)
    },
    [togglePresetEntryEnabled],
  )

  const handleAddToggle = useCallback(() => {
    setAddFormOpen((current) => !current)
  }, [])

  const handleDraftAlgorithmChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const algorithm = event.target.value as AlgorithmId
    const option = getAlgorithmOption(algorithm)
    setDraftAlgorithm(algorithm)
    setDraftLevel(option.defaultLevel)
  }, [])

  const handleDraftLevelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftLevel(Number(event.target.value))
  }, [])

  const handleDraftBase64Change = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftBase64(event.target.checked)
  }, [])

  const handleDraftBase85Change = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftBase85(event.target.checked)
  }, [])

  const handleAddPreset = useCallback(() => {
    const option = getAlgorithmOption(draftAlgorithm)
    const normalizedLevel = option.supportsLevel
      ? Math.max(option.minLevel, Math.min(option.maxLevel, draftLevel))
      : option.defaultLevel

    addPresetEntry(draftAlgorithm, normalizedLevel, { base64: draftBase64, base85: draftBase85 })
    setDraftBase64(false)
    setDraftBase85(false)
  }, [addPresetEntry, draftAlgorithm, draftBase64, draftBase85, draftLevel])

  const presetRows = useMemo(
    () =>
      presetEntries.map((entry) => {
        const option = getAlgorithmOption(entry.algorithm)
        const level = option.supportsLevel ? entry.level : option.defaultLevel
        const notation = buildPresetNotation(entry.algorithm, level, entry.modifiers)

        return (
          <li key={entry.id} className="min-w-0">
            <label className="label cursor-pointer justify-start gap-2 py-1">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                data-preset-id={entry.id}
                checked={entry.enabled}
                onChange={handlePresetToggle}
              />
              <span className="label-text truncate font-mono text-sm">{notation}</span>
            </label>
          </li>
        )
      }),
    [handlePresetToggle, presetEntries],
  )

  return (
    <section className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">
            <ListChecks className="h-4 w-4" />
            Presets
          </h2>
          <span className="badge badge-outline">{selectedCount} selected</span>
        </header>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-box border border-base-300 bg-base-100 p-3">
          {presetRows}
        </ul>

        <button type="button" className="btn btn-sm btn-outline self-start" onClick={handleAddToggle}>
          <Plus className="h-4 w-4" />
          {addFormOpen ? 'Hide Add' : 'Add'}
        </button>

        {addFormOpen && (
          <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
            <div className="grid gap-3">
              <label className="form-control">
                <span className="label py-1">
                  <span className="label-text">Algorithm</span>
                </span>
                <select className="select select-bordered" value={draftAlgorithm} onChange={handleDraftAlgorithmChange}>
                  {algorithmOptionItems}
                </select>
              </label>

              {draftOption.supportsLevel && (
                <label className="form-control">
                  <span className="label py-1">
                    <span className="label-text">Compression: {draftLevel}</span>
                  </span>
                  <input
                    className="range range-primary range-sm"
                    type="range"
                    min={draftOption.minLevel}
                    max={draftOption.maxLevel}
                    step={draftOption.step}
                    value={draftLevel}
                    onChange={handleDraftLevelChange}
                  />
                </label>
              )}

              <div className="space-y-1">
                <p className="text-sm font-medium">Post</p>
                <label className="label cursor-pointer justify-start gap-2 py-1">
                  <input className="checkbox checkbox-sm" type="checkbox" checked={draftBase64} onChange={handleDraftBase64Change} />
                  <span className="label-text">base64</span>
                </label>
                <label className="label cursor-pointer justify-start gap-2 py-1 pl-3">
                  <input className="checkbox checkbox-sm" type="checkbox" checked={draftBase85} onChange={handleDraftBase85Change} />
                  <span className="label-text">base85</span>
                </label>
              </div>

              <button type="button" className="btn btn-sm btn-primary self-start" onClick={handleAddPreset}>
                Add preset
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
