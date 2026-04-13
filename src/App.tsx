import { Activity, Gauge, ExternalLink } from 'lucide-react'

import { CompressionWorkbenchLayout } from './components/layout/CompressionWorkbenchLayout'
import { RustCargoLibrariesDialog } from './components/layout/RustCargoLibrariesDialog'
import { CompressionWorkbenchProvider } from './context/compression-workbench-context'

function AppShell() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-base-200 text-base-content">
      <div className="mx-auto w-full max-w-screen-2xl space-y-4 p-4 md:p-6">
        <header className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
                <Gauge className="h-5 w-5" />
                Compression Leaderboard 
<div className="badge badge-outline badge-neutral">v{__APP_VERSION__}</div>

              </h1>
              <div className="mt-2 flex items-center gap-2 text-sm text-base-content/70">
                <Activity className="h-4 w-6" />
                <p>Local compression benchmarking tool for developers and enthusiasts. Compare algorithms, visualize performance, and optimize your data compression strategies with ease. Data will be processed locally in your browser, ensuring privacy and security.
                The compression backend is Rust/WASM. The source code is available on 
                <a
                  href="https://github.com/45deg/compression-leaderboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link ml-1 inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>GitHub</span>
                </a>.
                </p>
              </div>
            </div>

            <RustCargoLibrariesDialog />
          </div>
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
