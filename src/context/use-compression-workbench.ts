import { useContext } from 'react'

import {
  CompressionWorkbenchContext,
  type CompressionWorkbenchContextValue,
} from './compression-workbench-store'

export function useCompressionWorkbench(): CompressionWorkbenchContextValue {
  const context = useContext(CompressionWorkbenchContext)
  if (!context) {
    throw new Error('useCompressionWorkbench must be used inside CompressionWorkbenchProvider.')
  }
  return context
}
