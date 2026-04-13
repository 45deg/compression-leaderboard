import type { CompressionResultRow, ResultSortField, SortDirection } from '../types/compression'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function sortCompressionResults(
  rows: CompressionResultRow[],
  field: ResultSortField,
  direction: SortDirection,
): CompressionResultRow[] {
  const factor = direction === 'asc' ? 1 : -1
  const sorted = [...rows]

  sorted.sort((left, right) => {
    const leftValue = getSortValue(left, field)
    const rightValue = getSortValue(right, field)

    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return collator.compare(leftValue, rightValue) * factor
    }

    return ((leftValue as number) - (rightValue as number)) * factor
  })

  return sorted
}

function getSortValue(row: CompressionResultRow, field: ResultSortField): number | string {
  switch (field) {
    case 'algorithm':
      return row.label
    case 'params':
      return row.level
    case 'originalSize':
      return row.originalSize
    case 'compressedSize':
      return row.compressedSize
    case 'payloadSize':
      return row.payloadSize
    case 'overheadBytes':
      return row.overheadBytes
    case 'ratio':
      return row.ratio
    case 'compressionMs':
      return row.compressionMs
    case 'decompressionMs':
      return row.decompressionMs
    case 'encodeMs':
      return row.encodeMs
    case 'throughputMbps':
      return row.throughputMbps
  }
}
