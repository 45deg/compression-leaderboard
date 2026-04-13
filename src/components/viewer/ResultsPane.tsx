import { ResultsChartCard } from './ResultsChartCard'
import { ResultsTableCard } from './ResultsTableCard'

export function ResultsPane() {
  return (
    <section className="space-y-4 min-w-0">
      <ResultsChartCard />
      <ResultsTableCard />
    </section>
  )
}
