import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Panel from '../components/ui/Panel.jsx'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import { toneForDifficulty, barColorForDifficulty } from '../utils/difficulty.js'
import { formatDuration, formatShortDateTime } from '../utils/time.js'
import { getMyProgress, getProgressRecommendations } from '../services/progressService.js'
import { listProblems } from '../services/problemService.js'
import { getSubmissionHistory } from '../services/submissionService.js'

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [recommendationError, setRecommendationError] = useState('')
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [progress, problems, history] = await Promise.all([
        getMyProgress(),
        listProblems(),
        getSubmissionHistory(),
      ])
      setData({ progress, problems, history })
    } catch (err) {
      setError(err.message || 'Could not load your dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  async function handleRecommendations() {
    setLoadingRecommendations(true)
    setRecommendationError('')
    try {
      setRecommendations(await getProgressRecommendations())
    } catch (err) {
      setRecommendationError(err.message || 'Could not load AI recommendations.')
    } finally {
      setLoadingRecommendations(false)
    }
  }

  const problemsById = useMemo(
    () => new Map((data?.problems || []).map((problem) => [Number(problem.id), problem])),
    [data?.problems],
  )

  if (loading) return <p className="py-12 text-center text-sm text-zinc-500">Loading your dashboard…</p>
  if (error) return (
    <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-4">
      <p role="alert" className="text-sm text-red-300">Could not load your dashboard: {error}</p>
      <Button variant="secondary" className="mt-3" onClick={loadDashboard}>Retry</Button>
    </div>
  )

  const { progress, problems, history } = data
  const averageTime = progress.averageSolvingTimeSeconds == null
    ? '—'
    : formatDuration(Math.round(progress.averageSolvingTimeSeconds))
  const weakTopics = [...progress.topicMastery].sort((a, b) => a.mastery - b.mastery).slice(0, 3)
  const suggestedProblems = [...problems]
    .filter((problem) => !problem.solved)
    .sort((a, b) => {
      const aRank = weakTopics.findIndex((topic) => topic.topic === a.topic)
      const bRank = weakTopics.findIndex((topic) => topic.topic === b.topic)
      const aScore = aRank < 0 ? weakTopics.length + (a.difficulty === 'Easy' ? 0 : 1) : aRank
      const bScore = bRank < 0 ? weakTopics.length + (b.difficulty === 'Easy' ? 0 : 1) : bRank
      return aScore - bScore || a.title.localeCompare(b.title)
    })
    .slice(0, 3)

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">A snapshot of your saved submissions and learning progress.</p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Problems solved" value={progress.problemsSolved} sublabel={`of ${problems.length}`} />
        <StatCard label="Accuracy" value={`${progress.accuracy}%`} />
        <StatCard label="Current streak" value={`${progress.currentStreak} days`} />
        <StatCard label="Avg. solving time" value={averageTime} />
        <StatCard label="Total submissions" value={progress.totalAttempts} />
      </div>

      <Panel title="Learning progress" className="mb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {DIFFICULTIES.map((difficulty) => {
            const solved = progress.difficultyDistribution.find((item) => item.difficulty === difficulty)?.solved || 0
            const total = problems.filter((problem) => problem.difficulty === difficulty).length
            const percent = total ? Math.min(100, Math.round((solved / total) * 100)) : 0
            return <div key={difficulty}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-zinc-300">{difficulty}</span>
                <span className="text-zinc-500">{solved}/{total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full ${barColorForDifficulty(difficulty)}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Recent activity">
            {history.length ? <ul className="flex flex-col divide-y divide-zinc-800">
              {history.slice(0, 5).map((entry) => {
                const problem = problemsById.get(Number(entry.problemId))
                return <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link to={`/problems/${entry.problemId}`} className="truncate text-sm text-zinc-200 hover:text-amber-300">
                      {problem?.title || `Problem #${entry.problemId}`}
                    </Link>
                    <p className="text-xs text-zinc-500">{formatShortDateTime(entry.date)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {problem && <Badge tone={toneForDifficulty(problem.difficulty)}>{problem.difficulty}</Badge>}
                    <Badge tone={entry.status === 'Accepted' ? 'success' : 'neutral'}>{entry.status}</Badge>
                  </div>
                </li>
              })}
            </ul> : <p className="text-sm text-zinc-500">Your submissions will appear here after you submit a solution.</p>}
          </Panel>

          <Panel title="Suggested problems">
            <p className="mb-3 text-xs text-zinc-500">Prioritized from your least mastered topics and unsolved problems.</p>
            {suggestedProblems.length ? <ul className="flex flex-col divide-y divide-zinc-800">
              {suggestedProblems.map((problem) => {
                const topic = weakTopics.find((item) => item.topic === problem.topic)
                return <li key={problem.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link to={`/problems/${problem.id}`} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-200 hover:text-amber-300">{problem.title}</span>
                    <Badge tone={toneForDifficulty(problem.difficulty)}>{problem.difficulty}</Badge>
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-500">{problem.topic}{topic ? ` · ${topic.mastery}% mastery` : ''}</p>
                </li>
              })}
            </ul> : <p className="text-sm text-zinc-500">No unsolved problems are available in the catalog.</p>}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="AI learning recommendations" action={<Badge tone="ai">AI</Badge>}>
            <p className="mb-3 text-xs text-zinc-500">Generated from aggregate progress; your source code is not sent.</p>
            <Button variant="ai" onClick={handleRecommendations} disabled={loadingRecommendations}>
              {loadingRecommendations ? 'Thinking…' : recommendations.length ? 'Refresh recommendations' : 'Get recommendations'}
            </Button>
            {recommendationError && <p role="alert" className="mt-3 text-sm text-red-300">{recommendationError}</p>}
            {recommendations.length > 0 && <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-zinc-300">
              {recommendations.map((item, index) => <li key={index}>{item}</li>)}
            </ul>}
          </Panel>

          <Panel title="Topics to practice">
            {weakTopics.length ? <ul className="flex flex-col gap-3">
              {weakTopics.map((item) => <li key={item.topic}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{item.topic}</span><span className="text-zinc-500">{item.mastery}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${item.mastery}%` }} />
                </div>
              </li>)}
            </ul> : <p className="text-sm text-zinc-500">Submit solutions across topics to see where to focus.</p>}
          </Panel>

          <Panel title="Recent improvements">
            <ul className="flex flex-col gap-2 text-sm text-zinc-400">
              {progress.recentImprovements.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
