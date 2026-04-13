import type {
  AlgorithmId,
  ChartMetric,
  CompressionAlgorithmOption,
  CompressionModifiers,
  PresetEntry,
} from '../types/compression'

export const ALGORITHM_OPTIONS: CompressionAlgorithmOption[] = [
  {
    algorithm: 'deflate',
    label: 'deflate-raw',
    supportsLevel: true,
    defaultLevel: 6,
    minLevel: 1,
    maxLevel: 9,
    step: 1,
  },
  { algorithm: 'zlib', label: 'zlib', supportsLevel: true, defaultLevel: 6, minLevel: 1, maxLevel: 9, step: 1 },
  { algorithm: 'gzip', label: 'gzip', supportsLevel: true, defaultLevel: 6, minLevel: 1, maxLevel: 9, step: 1 },
  { algorithm: 'brotli', label: 'brotli', supportsLevel: true, defaultLevel: 4, minLevel: 0, maxLevel: 11, step: 1 },
  {
    algorithm: 'bzip2',
    label: 'bzip2-legacy',
    supportsLevel: true,
    defaultLevel: 6,
    minLevel: 1,
    maxLevel: 9,
    step: 1,
  },
  { algorithm: 'zstd', label: 'zstd', supportsLevel: true, defaultLevel: 3, minLevel: 1, maxLevel: 22, step: 1 },
  {
    algorithm: 'zstdMagicless',
    label: 'zstd-raw',
    supportsLevel: true,
    defaultLevel: 3,
    minLevel: 1,
    maxLevel: 22,
    step: 1,
  },
  { algorithm: 'lz4', label: 'lz4', supportsLevel: false, defaultLevel: 0, minLevel: 0, maxLevel: 0, step: 1 },
  { algorithm: 'lzo', label: 'lzo', supportsLevel: false, defaultLevel: 0, minLevel: 0, maxLevel: 0, step: 1 },
  { algorithm: 'xz', label: 'xz', supportsLevel: true, defaultLevel: 6, minLevel: 0, maxLevel: 9, step: 1 },
  { algorithm: 'snappy', label: 'snappy', supportsLevel: false, defaultLevel: 0, minLevel: 0, maxLevel: 0, step: 1 },
]

export const DEFAULT_MODIFIERS: CompressionModifiers = {
  base64: false,
  base85: false,
}

export const DEFAULT_PRESET_ENTRIES: PresetEntry[] = [
  {
    id: 'default-deflate-6',
    enabled: true,
    algorithm: 'deflate',
    level: 6,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-brotli-4',
    enabled: true,
    algorithm: 'brotli',
    level: 4,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-zlib-6',
    enabled: false,
    algorithm: 'zlib',
    level: 6,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-gzip-6',
    enabled: false,
    algorithm: 'gzip',
    level: 6,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-lz4',
    enabled: false,
    algorithm: 'lz4',
    level: 0,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-lzo',
    enabled: false,
    algorithm: 'lzo',
    level: 0,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-xz',
    enabled: true,
    algorithm: 'xz',
    level: 6,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-snappy',
    enabled: false,
    algorithm: 'snappy',
    level: 0,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-zstd-3',
    enabled: false,
    algorithm: 'zstd',
    level: 3,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
  {
    id: 'default-zstd-magicless-3',
    enabled: false,
    algorithm: 'zstdMagicless',
    level: 3,
    modifiers: { ...DEFAULT_MODIFIERS },
    source: 'default',
  },
]

export const DEFAULT_METRIC: ChartMetric = 'ratio'

export const METRIC_OPTIONS: Array<{ value: ChartMetric; label: string }> = [
  { value: 'ratio', label: 'Compression Ratio' },
  { value: 'compressionMs', label: 'Compression Time (ms)' },
  { value: 'throughputMbps', label: 'Throughput (MB/s)' },
]

export function getAlgorithmOption(algorithm: AlgorithmId): CompressionAlgorithmOption {
  const option = ALGORITHM_OPTIONS.find((value) => value.algorithm === algorithm)
  if (!option) {
    throw new Error(`Unknown algorithm option: ${algorithm}`)
  }
  return option
}

export function buildPresetNotation(algorithm: AlgorithmId, level: number, modifiers: CompressionModifiers): string {
  const option = getAlgorithmOption(algorithm)
  const base = option.supportsLevel ? `${option.label}(${level})` : option.label
  const posts = getPostLabels(modifiers)

  if (posts.length === 0) {
    return base
  }

  return `${base}+${posts.join('+')}`
}

function getPostLabels(modifiers: CompressionModifiers): string[] {
  const labels: string[] = []

  if (modifiers.base64) {
    labels.push('base64')
  }
  if (modifiers.base85) {
    labels.push('base85')
  }

  return labels
}
