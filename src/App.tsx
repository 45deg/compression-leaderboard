import { Activity, Gauge } from 'lucide-react'

import { CompressionWorkbenchLayout } from './components/layout/CompressionWorkbenchLayout'
import { CompressionWorkbenchProvider } from './context/compression-workbench-context'

function AppShell() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-base-200 text-base-content">
      <div className="mx-auto w-full max-w-screen-2xl space-y-4 p-4 md:p-6">
        <header className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
            <Gauge className="h-5 w-5" />
            Compression Leaderboard
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-base-content/70">
            <Activity className="h-4 w-4" />
            Benchmark Rust-WASM codecs in a worker without blocking the UI thread.
          </p>
        </header>

        <CompressionWorkbenchLayout />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <CompressionWorkbenchProvider>
      <AppShell />
    </CompressionWorkbenchProvider>
  )
}
