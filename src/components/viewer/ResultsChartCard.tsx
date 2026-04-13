import { useCallback, useMemo, type ChangeEvent } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useCompressionWorkbench } from '../../context/use-compression-workbench'
import type { ChartMetric } from '../../types/compression'
import { METRIC_OPTIONS } from '../../utils/compression-config'
import { formatDuration, formatRatio, formatThroughput } from '../../utils/formatters'

interface ChartRow {
  name: string
  ratio: number
  compressionMs: number
  throughputMbps: number
}

export function ResultsChartCard() {
  const { results, metric, setMetric } = useCompressionWorkbench()

  const chartRows = useMemo<ChartRow[]>(
    () =>
      results.map((result) => ({
        name: result.label,
        ratio: result.ratio,
        compressionMs: result.compressionMs,
        throughputMbps: result.throughputMbps,
      })),
    [results],
  )

  const handleMetricChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setMetric(event.target.value as ChartMetric)
    },
    [setMetric],
  )

  const xAxisFormatter = useCallback(
    (value: number | string) => {
      const numericValue = typeof value === 'number' ? value : Number(value)
      return formatMetricValue(metric, Number.isFinite(numericValue) ? numericValue : 0)
    },
    [metric],
  )

  return (
    <section className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="card-title text-base">Leaderboard Chart</h2>
          <label className="form-control w-full max-w-64">
            <div className="label py-0">
              <span className="label-text text-xs uppercase tracking-wide text-base-content/70">Metric</span>
            </div>
            <select className="select select-bordered select-sm" value={metric} onChange={handleMetricChange}>
              {METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        {chartRows.length === 0 ? (
          <div className="rounded-box border border-dashed border-base-300 p-8 text-center text-sm text-base-content/60">
            Run at least one preset to render the leaderboard.
          </div>
        ) : (
          <div className="h-96 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={xAxisFormatter} />
                <YAxis dataKey="name" type="category" width={180} />
                <Tooltip />
                {metric === 'ratio' && <ReferenceLine x={1} stroke="#f97316" strokeDasharray="6 4" ifOverflow="extendDomain" />}
                <Bar dataKey={metric} fill="#4f46e5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}

function formatMetricValue(metric: ChartMetric, value: number): string {
  if (metric === 'ratio') {
    return formatRatio(value)
  }
  if (metric === 'compressionMs') {
    return formatDuration(value)
  }
  return formatThroughput(value)
}
