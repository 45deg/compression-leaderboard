import { ArrowUpDown, Download } from 'lucide-react'
import { useCallback, useMemo, type MouseEvent } from 'react'

import { useCompressionWorkbench } from '../../context/use-compression-workbench'
import type { CompressionResultRow, ResultSortField } from '../../types/compression'
import { getAlgorithmOption } from '../../utils/compression-config'
import { formatBytes, formatDuration, formatRatio, formatThroughput } from '../../utils/formatters'

interface SortableColumn {
  field: ResultSortField
  label: string
}

const sortableColumns: SortableColumn[] = [
  { field: 'algorithm', label: 'Algorithm' },
  { field: 'params', label: 'Level/Params' },
  { field: 'compressedSize', label: 'Total Size' },
  { field: 'payloadSize', label: 'Payload Size' },
  { field: 'overheadBytes', label: 'Overhead (Bytes)' },
  { field: 'ratio', label: 'Ratio' },
  { field: 'compressionMs', label: 'Compression' },
  { field: 'decompressionMs', label: 'Decompression' },
  { field: 'encodeMs', label: 'Encode Time' },
  { field: 'throughputMbps', label: 'Throughput' },
]

export function ResultsTableCard() {
  const { results, sortField, sortDirection, updateSort, originalSize } = useCompressionWorkbench()

  const rowsByPreset = useMemo(() => {
    const map = new Map<string, CompressionResultRow>()
    for (const row of results) {
      map.set(row.presetId, row)
    }
    return map
  }, [results])

  const handleSortClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const field = event.currentTarget.dataset.field as ResultSortField | undefined
      if (!field) {
        return
      }
      updateSort(field)
    },
    [updateSort],
  )

  const handleDownload = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const presetId = event.currentTarget.dataset.presetId
      if (!presetId) {
        return
      }

      const row = rowsByPreset.get(presetId)
      if (!row) {
        return
      }

      const binaryPayload = new Uint8Array(row.binary).buffer
      const blob = new Blob([binaryPayload], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${row.presetId}.bin`
      link.click()
      URL.revokeObjectURL(url)
    },
    [rowsByPreset],
  )

  const tableRows = useMemo(
    () =>
      results.map((row) => (
        <tr key={row.presetId}>
          <td>{row.label}</td>
          <td>{getAlgorithmOption(row.algorithm).supportsLevel ? `level=${row.level}` : '-'}</td>
          <td>
            {formatBytes(row.compressedSize)}
            {row.encoding !== 'none' && <span className="badge badge-outline ml-2">{row.encoding}</span>}
          </td>
          <td>{formatBytes(row.payloadSize)}</td>
          <td>{formatBytes(row.overheadBytes)}</td>
          <td>{formatRatio(row.ratio)}</td>
          <td>{formatDuration(row.compressionMs)}</td>
          <td>{formatDuration(row.decompressionMs)}</td>
          <td>{formatDuration(row.encodeMs)}</td>
          <td>{formatThroughput(row.throughputMbps)}</td>
          <td className="whitespace-nowrap">
            <button
              type="button"
              className="btn btn-xs btn-outline"
              data-preset-id={row.presetId}
              onClick={handleDownload}
              aria-label={`Download binary for ${row.label}`}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
      )),
    [handleDownload, results],
  )

  return (
    <section className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <header className="flex items-center justify-between">
          <h2 className="card-title text-base">Data Grid</h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="badge badge-neutral">Input Size: {formatBytes(originalSize)}</span>
            <span className="badge badge-outline">{results.length} rows</span>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="table table-pin-rows table-zebra text-sm">
            <thead>
              <tr>
                {sortableColumns.map((column) => (
                  <th key={column.field}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      data-field={column.field}
                      onClick={handleSortClick}
                    >
                      {column.label}
                      <ArrowUpDown
                        className={`h-3.5 w-3.5 ${sortField === column.field ? 'opacity-100' : 'opacity-40'}`}
                      />
                      {sortField === column.field && (
                        <span className="text-[10px] uppercase tracking-wide">{sortDirection}</span>
                      )}
                    </button>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length > 0 ? (
                tableRows
              ) : (
                <tr>
                  <td className="text-center text-base-content/60" colSpan={sortableColumns.length + 1}>
                    No benchmark output yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
