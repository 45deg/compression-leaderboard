import { AlgorithmSelectionCard } from './AlgorithmSelectionCard'
import { InputSourceCard } from './InputSourceCard'
import { RunButtonBar } from './RunButtonBar'

export function ControlsPane() {
  return (
    <section className="space-y-4 min-w-0">
      <RunButtonBar />
      <InputSourceCard />
      <AlgorithmSelectionCard />
    </section>
  )
}
