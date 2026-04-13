import { ControlsPane } from '../explorer/ControlsPane'
import { ResultsPane } from '../viewer/ResultsPane'

export function CompressionWorkbenchLayout() {
  return (
    <div className="mx-auto grid w-full min-w-0 gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <aside className="min-w-0">
        <ControlsPane />
      </aside>
      <main className="min-w-0">
        <ResultsPane />
      </main>
    </div>
  )
}
