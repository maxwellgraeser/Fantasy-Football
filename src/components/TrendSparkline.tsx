import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

interface Props {
  data: number[]
  width?: number
  height?: number
}

export function TrendSparkline({ data, width = 80, height = 28 }: Props) {
  if (!data || data.length < 2) {
    return <span className="text-slate-600 text-xs">—</span>
  }

  const chartData = data.map((v, i) => ({ i, v }))
  const last = data[data.length - 1]
  const first = data[0]
  const trending = last >= first

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={trending ? '#34d399' : '#f87171'}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ background: '#1e2130', border: '1px solid #2e3347', borderRadius: 6, fontSize: 11 }}
          formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : '—', 'PPG']}
          labelFormatter={() => ''}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
