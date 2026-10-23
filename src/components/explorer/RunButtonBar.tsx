import { Play, Square } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import { useCompressionWorkbench } from '../../context/use-compression-workbench'

export function RunButtonBar() {
  const { runCompression, cancelCompression, isRunning, isWorkerReady, originalSize, presetEntries, progress, errorMessage } =
    useCompressionWorkbench()

  const enabledCount = useMemo(() => presetEntries.filter((entry) => entry.enabled).length, [presetEntries])
  const canRun = !isRunning && isWorkerReady && originalSize > 0 && enabledCount > 0

  const handleRun = useCallback(() => {
    void runCompression()
  }, [runCompression])

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`btn btn-primary w-full ${isRunning ? 'btn-disabled' : ''}`}
        disabled={!canRun}
        onClick={handleRun}
      >
        <Play className="h-4 w-4" />
        Run
      </button>
      {isRunning && (
        <button type="button" className="btn btn-outline w-full" onClick={cancelCompression}>
          <Square className="h-4 w-4" />
          Cancel
        </button>
      )}
      <div className="text-xs text-base-content/70">
        {isRunning
          ? progress
            ? `Running ${progress.completed}/${progress.total}: ${progress.currentLabel}`
            : 'Running...'
          : `Ready: ${enabledCount} preset(s) enabled`}
      </div>
      {errorMessage && <div className="text-xs text-error">{errorMessage}</div>}
    </div>
  )
}
