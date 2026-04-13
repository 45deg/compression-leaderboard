import type { AlgorithmId } from '../types/compression'

export function getContainerOverheadBytes(algorithm: AlgorithmId, binary: Uint8Array): number {
  if (binary.length === 0) {
    return 0
  }

  switch (algorithm) {
    case 'gzip':
      return getGzipOverheadBytes(binary)
    case 'zstd':
      return getZstdOverheadBytes(binary, true)
    case 'zstdMagicless':
      return getZstdOverheadBytes(binary, false)
    default:
      return 0
  }
}

function getZstdOverheadBytes(binary: Uint8Array, withMagicNumber: boolean): number {
  const baseOffset = withMagicNumber ? 4 : 0
  if (binary.length <= baseOffset) {
    return 0
  }

  if (
    withMagicNumber &&
    !(
      binary[0] === 0x28 &&
      binary[1] === 0xb5 &&
      binary[2] === 0x2f &&
      binary[3] === 0xfd
    )
  ) {
    return 0
  }

  const frameHeaderDescriptor = binary[baseOffset]
  if (frameHeaderDescriptor === undefined) {
    return 0
  }

  const frameContentSizeFlag = frameHeaderDescriptor >> 6
  const singleSegment = (frameHeaderDescriptor & 0x20) !== 0
  const contentChecksumFlag = (frameHeaderDescriptor & 0x04) !== 0
  const dictionaryIdFlag = frameHeaderDescriptor & 0x03
  const dictionaryIdBytes = dictionaryIdFlag === 0 ? 0 : dictionaryIdFlag === 1 ? 1 : dictionaryIdFlag === 2 ? 2 : 4
  const windowDescriptorBytes = singleSegment ? 0 : 1
  const frameContentSizeBytes = getZstdFrameContentSizeBytes(frameContentSizeFlag, singleSegment)
  const headerBytes = baseOffset + 1 + windowDescriptorBytes + dictionaryIdBytes + frameContentSizeBytes
  const checksumBytes = contentChecksumFlag ? 4 : 0

  if (binary.length < headerBytes + checksumBytes) {
    return 0
  }

  return headerBytes + checksumBytes
}

function getZstdFrameContentSizeBytes(flag: number, singleSegment: boolean): number {
  if (singleSegment) {
    if (flag === 0) {
      return 1
    }
    return 1 << flag
  }

  if (flag === 0) {
    return 0
  }
  if (flag === 1) {
    return 2
  }
  if (flag === 2) {
    return 4
  }
  return 8
}

function getGzipOverheadBytes(binary: Uint8Array): number {
  if (binary.length < 18) {
    return 0
  }
  if (binary[0] !== 0x1f || binary[1] !== 0x8b) {
    return 0
  }

  const flags = binary[3]
  let cursor = 10
  const trailerBytes = 8
  const dataEnd = binary.length - trailerBytes
  if (dataEnd <= cursor) {
    return 0
  }

  if ((flags & 0x04) !== 0) {
    if (cursor + 2 > dataEnd) {
      return 0
    }
    const extraLength = binary[cursor] | (binary[cursor + 1] << 8)
    cursor += 2 + extraLength
    if (cursor > dataEnd) {
      return 0
    }
  }

  if ((flags & 0x08) !== 0) {
    cursor = findNullTerminator(binary, cursor, dataEnd)
    if (cursor < 0) {
      return 0
    }
  }

  if ((flags & 0x10) !== 0) {
    cursor = findNullTerminator(binary, cursor, dataEnd)
    if (cursor < 0) {
      return 0
    }
  }

  if ((flags & 0x02) !== 0) {
    if (cursor + 2 > dataEnd) {
      return 0
    }
    cursor += 2
  }

  if (cursor > dataEnd) {
    return 0
  }

  return cursor + trailerBytes
}

function findNullTerminator(binary: Uint8Array, start: number, end: number): number {
  for (let index = start; index < end; index += 1) {
    if (binary[index] === 0) {
      return index + 1
    }
  }
  return -1
}
