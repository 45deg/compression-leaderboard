export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)} µs`
  }
  return `${ms.toFixed(2)} ms`
}

export function formatRatio(ratio: number): string {
  return ratio.toFixed(4)
}

export function formatThroughput(mbps: number): string {
  return `${mbps.toFixed(2)} MB/s`
}
