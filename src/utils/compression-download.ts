import type { AlgorithmId } from '../types/compression'

const ALGORITHM_DOWNLOAD_EXTENSIONS: Record<AlgorithmId, string> = {
  deflate: '.deflate.bin',
  zlib: '.zlib',
  gzip: '.gz',
  brotli: '.br',
  bzip2: '.bz2',
  zstd: '.zst',
  zstdMagicless: '.zstd.bin',
  lz4: '.lz4',
  lzo: '.lzo',
  xz: '.xz',
  snappy: '.snappy.bin',
}

export function buildCompressedDownloadFilename(presetId: string, algorithm: AlgorithmId): string {
  return `${presetId}${ALGORITHM_DOWNLOAD_EXTENSIONS[algorithm]}`
}
