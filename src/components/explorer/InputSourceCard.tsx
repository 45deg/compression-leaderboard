import { FileText, Upload } from 'lucide-react'
import { useCallback, type ChangeEvent } from 'react'

import { useCompressionWorkbench } from '../../context/use-compression-workbench'
import { formatBytes } from '../../utils/formatters'

export function InputSourceCard() {
  const { inputMode, setInputMode, textInput, setTextInput, setSelectedFile, selectedFileName, originalSize } =
    useCompressionWorkbench()

  const handleTextModeSelect = useCallback(() => {
    setInputMode('text')
  }, [setInputMode])

  const handleFileModeSelect = useCallback(() => {
    setInputMode('file')
  }, [setInputMode])

  const handleTextChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setTextInput(event.target.value)
    },
    [setTextInput],
  )

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      setSelectedFile(file)
    },
    [setSelectedFile],
  )

  return (
    <section className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">
            <FileText className="h-4 w-4" />
            Input Source
          </h2>
          <span className="badge badge-neutral">Original {formatBytes(originalSize)}</span>
        </header>

        <div className="join w-full">
          <button
            type="button"
            className={`join-item btn btn-sm flex-1 ${inputMode === 'text' ? 'btn-primary' : 'btn-outline'}`}
            onClick={handleTextModeSelect}
          >
            Text
          </button>
          <button
            type="button"
            className={`join-item btn btn-sm flex-1 ${inputMode === 'file' ? 'btn-primary' : 'btn-outline'}`}
            onClick={handleFileModeSelect}
          >
            File
          </button>
        </div>

        {inputMode === 'text' ? (
          <textarea
            className="textarea textarea-bordered min-h-40 w-full"
            placeholder="Paste or type benchmark input..."
            value={textInput}
            onChange={handleTextChange}
          />
        ) : (
          <div className="space-y-2">
            <label className="form-control w-full">
              <div className="label py-1">
                <span className="label-text">Upload file</span>
              </div>
              <input className="file-input file-input-bordered w-full" type="file" onChange={handleFileChange} />
            </label>
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <Upload className="h-4 w-4" />
              <span>{selectedFileName ?? 'No file selected.'}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
