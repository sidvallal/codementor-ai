import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import Panel from '../components/ui/Panel.jsx'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import { formatDuration } from '../utils/time.js'
import { getMyProgress, getProgressRecommendations } from '../services/progressService.js'

const DIFFICULTY_COLORS = { Easy: '#34d399', Medium: '#facc15', Hard: '#f87171' }
const CHART_GRID_COLOR = '#27272a'
const CHART_TICK = { fill: '#71717a', fontSize: 11 }
const TOOLTIP_STYLE = { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }

function ProgressPage() {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [recommendationError, setRecommendationError] = useState('')
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)

  useEffect(() => {
    let active = true
    getMyProgress()
      .then((data) => { if (active) setProgress(data) })
      .catch((err) => { if (active) setError(err.message || 'Could not load your progress.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleRecommendations() {
    setLoadingRecommendations(true)
    setRecommendationError('')
    try {
      setRecommendations(await getProgressRecommendations())
    } catch (err) {
      setRecommendationError(err.message || 'Could not load recommendations.')
    } finally {
      setLoadingRecommendations(false)
    }
  }

  if (loading) return <p className="py-12 text-center text-sm text-zinc-500">Loading your progress…</p>
  if (error) return (
    <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-300">
      Could not load your progress: {error}
    </div>
  )

  const weakTopics = [...progress.topicMastery].sort((a, b) => a.mastery - b.mastery).slice(0, 3)
  const strongTopics = [...progress.topicMastery].sort((a, b) => b.mastery - a.mastery).slice(0, 3)
  const hasAttempts = progress.totalAttempts > 0
  const hasSolved = progress.problemsSolved > 0

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Progress</h1>
        <p className="mt-1 text-sm text-zinc-400">Analytics from your saved submissions.</p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Problems solved" value={progress.problemsSolved} />
        <StatCard label="Accuracy" value={`${progress.accuracy}%`} sublabel={`${progress.acceptedAttempts} accepted submissions`} />
        <StatCard label="Total attempts" value={progress.totalAttempts} />
        <StatCard label="Current streak" value={`${progress.currentStreak} days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Difficulty distribution">
          {hasSolved ? <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={progress.difficultyDistribution} dataKey="solved" nameKey="difficulty" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {progress.difficultyDistribution.map((entry) => <Cell key={entry.difficulty} fill={DIFFICULTY_COLORS[entry.difficulty] || '#818cf8'} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              {progress.difficultyDistribution.map((entry) => <div key={entry.difficulty} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DIFFICULTY_COLORS[entry.difficulty] || '#818cf8' }} />
                <span className="text-zinc-400">{entry.difficulty}</span><span className="text-zinc-600">{entry.solved}</span>
              </div>)}
            </div>
          </> : <p className="py-16 text-center text-sm text-zinc-500">Solve a problem to see your distribution.</p>}
        </Panel>

        <Panel title="Solving-time trend">
          {progress.solvingTimeTrend.some((entry) => entry.minutes != null) ? <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progress.solvingTimeTrend}>
                <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={CHART_TICK} axisLine={{ stroke: CHART_GRID_COLOR }} tickLine={false} />
                <YAxis tick={CHART_TICK} axisLine={{ stroke: CHART_GRID_COLOR }} tickLine={false} width={30} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}m`, 'Avg. time']} />
                <Line type="monotone" dataKey="minutes" connectNulls={false} stroke="#fbbf24" strokeWidth={2} dot={{ r: 3, fill: '#fbbf24' }} />
              </LineChart>
            </ResponsiveContainer>
          </div> : <p className="py-16 text-center text-sm text-zinc-500">Accepted submissions with a recorded solving time will appear here.</p>}
          {progress.averageSolvingTimeSeconds != null && <p className="mt-2 text-center text-xs text-zinc-500">Average accepted solve: {formatDuration(Math.round(progress.averageSolvingTimeSeconds))}</p>}
        </Panel>
      </div>

      <Panel title="Topic mastery" className="mt-4">
        {progress.topicMastery.length ? <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={progress.topicMastery} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={CHART_TICK} axisLine={{ stroke: CHART_GRID_COLOR }} tickLine={false} />
              <YAxis type="category" dataKey="topic" tick={CHART_TICK} width={130} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, _name, item) => [`${value}% (${item.payload.solved}/${item.payload.attempted} solved)`, 'Mastery']} />
              <Bar dataKey="mastery" fill="#fbbf24" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div> : <p className="py-16 text-center text-sm text-zinc-500">Topic mastery appears after you submit a solution.</p>}
      </Panel>

      {hasAttempts && <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Strong topics">
          {strongTopics.length ? <ul className="flex flex-col gap-2">{strongTopics.map((item) => <li key={item.topic} className="flex items-center justify-between text-sm"><span className="text-emerald-300">{item.topic}</span><span className="text-zinc-500">{item.mastery}% · {item.solved}/{item.attempted}</span></li>)}</ul> : <p className="text-sm text-zinc-500">Not enough topic data yet.</p>}
        </Panel>
        <Panel title="Topics to practice">
          {weakTopics.length ? <ul className="flex flex-col gap-2">{weakTopics.map((item) => <li key={item.topic} className="flex items-center justify-between text-sm"><span className="text-zinc-200">{item.topic}</span><span className="text-zinc-500">{item.mastery}% · {item.solved}/{item.attempted}</span></li>)}</ul> : <p className="text-sm text-zinc-500">Not enough topic data yet.</p>}
        </Panel>
      </div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Recent improvements">
          <ul className="flex flex-col gap-2 text-sm text-zinc-400">{progress.recentImprovements.map((note, index) => <li key={index}>{note}</li>)}</ul>
        </Panel>
        <Panel title="AI recommendations" action={<Badge tone="ai">AI</Badge>}>
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500">Generated from your aggregate progress; your source code is not sent.</p>
            <Button variant="ai" onClick={handleRecommendations} disabled={loadingRecommendations}>{loadingRecommendations ? 'Thinking…' : recommendations.length ? 'Refresh recommendations' : 'Get recommendations'}</Button>
            {recommendationError && <p role="alert" className="text-sm text-red-300">{recommendationError}</p>}
            {recommendations.length > 0 && <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-zinc-300">{recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul>}
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default ProgressPage
