export type InputMode = 'text' | 'file'

export type AlgorithmId =
  | 'deflate'
  | 'zlib'
  | 'gzip'
  | 'brotli'
  | 'bzip2'
  | 'zstd'
  | 'zstdMagicless'
  | 'lz4'
  | 'lzo'
  | 'xz'
  | 'snappy'

export type EncodingMode = 'none' | 'base64' | 'base85'

export type PresetEntrySource = 'default' | 'custom'

export type ChartMetric = 'ratio' | 'compressionMs' | 'throughputMbps'

export type ResultSortField =
  | 'algorithm'
  | 'params'
  | 'originalSize'
  | 'compressedSize'
  | 'payloadSize'
  | 'overheadBytes'
  | 'ratio'
  | 'compressionMs'
  | 'decompressionMs'
  | 'encodeMs'
  | 'throughputMbps'

export type SortDirection = 'asc' | 'desc'

export interface CompressionAlgorithmOption {
  algorithm: AlgorithmId
  label: string
  defaultLevel: number
  minLevel: number
  maxLevel: number
  step: number
  supportsLevel: boolean
}

export interface CompressionModifiers {
  base64: boolean
  base85: boolean
}

export interface PresetEntry {
  id: string
  enabled: boolean
  algorithm: AlgorithmId
  level: number
  modifiers: CompressionModifiers
  source: PresetEntrySource
}

export interface CompressionJob {
  presetId: string
  label: string
  algorithm: AlgorithmId
  level: number
  modifiers: CompressionModifiers
}

export interface CompressionResultRow {
  presetId: string
  label: string
  algorithm: AlgorithmId
  level: number
  originalSize: number
  compressedSize: number
  binarySize: number
  payloadSize: number
  overheadBytes: number
  ratio: number
  binaryRatio: number
  compressionMs: number
  decompressionMs: number
  encodeMs: number
  throughputMbps: number
  encoding: EncodingMode
  binary: Uint8Array
  encodedText: string | null
}

export interface RunProgress {
  completed: number
  total: number
  currentLabel: string
}
