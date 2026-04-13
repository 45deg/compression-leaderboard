export function bytesToBase64(input: Uint8Array): string {
  const chunkSize = 32_768
  let binary = ''

  for (let offset = 0; offset < input.length; offset += chunkSize) {
    const chunk = input.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export function bytesToAscii85(input: Uint8Array): string {
  if (input.length === 0) {
    return ''
  }

  let output = ''

  for (let offset = 0; offset < input.length; offset += 4) {
    const remaining = Math.min(4, input.length - offset)
    const b0 = input[offset] ?? 0
    const b1 = input[offset + 1] ?? 0
    const b2 = input[offset + 2] ?? 0
    const b3 = input[offset + 3] ?? 0

    let value = (BigInt(b0) << 24n) | (BigInt(b1) << 16n) | (BigInt(b2) << 8n) | BigInt(b3)

    if (value === 0n && remaining === 4) {
      output += 'z'
      continue
    }

    const encoded = new Array<string>(5)
    for (let index = 4; index >= 0; index -= 1) {
      encoded[index] = String.fromCharCode(Number((value % 85n) + 33n))
      value /= 85n
    }

    output += remaining < 4 ? encoded.slice(0, remaining + 1).join('') : encoded.join('')
  }

  return output
}
