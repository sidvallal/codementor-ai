import { useEffect, useState } from 'react'
import { FiAward, FiClock, FiMic } from 'react-icons/fi'
import Panel from '../components/ui/Panel.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import FilterChip from '../components/ui/FilterChip.jsx'
import ReviewSection from '../components/ui/ReviewSection.jsx'
import CodeEditor from '../components/CodeEditor.jsx'
import { toneForDifficulty } from '../utils/difficulty.js'
import { formatDuration } from '../utils/time.js'
import { DIFFICULTIES, TOPICS, DEFAULT_STARTER_CODE } from '../data/problemsMockData.js'
import {
  pickInterviewProblem,
  getInterviewerOpening,
  getInterviewerFollowUp,
  getControlledHint,
  finishInterview,
  INTERVIEW_TIME_LIMITS_SECONDS,
  MAX_HINTS_PER_INTERVIEW,
} from '../services/interviewService.js'

// Phase 30 connects interview turns and feedback to the authenticated AI
// endpoints and uses the persisted Docker judge for the final score.
function Interview() {
  const [phase, setPhase] = useState('setup') // 'setup' | 'session' | 'summary'
  const [difficulty, setDifficulty] = useState('')
  const [topic, setTopic] = useState('')

  const [problem, setProblem] = useState(null)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(0)
  const [startedAt, setStartedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const [language, setLanguage] = useState('python')
  const [theme, setTheme] = useState('vs-dark')
  const [codeByLanguage, setCodeByLanguage] = useState({})

  const [conversation, setConversation] = useState([])
  const [approachText, setApproachText] = useState('')
  const [isInterviewerTyping, setIsInterviewerTyping] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)

  const [isFinishing, setIsFinishing] = useState(false)
  const [summary, setSummary] = useState(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (phase !== 'session') return undefined
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [phase])

  const starterCode = problem?.starterCode || DEFAULT_STARTER_CODE
  const currentCode = codeByLanguage[language] || ''
  const elapsedSeconds = startedAt ? Math.floor((now - startedAt) / 1000) : 0
  const remainingSeconds = Math.max(0, timeLimitSeconds - elapsedSeconds)
  const isTimeUp = phase === 'session' && remainingSeconds === 0

  async function handleStart() {
    setActionError('')
    setIsStarting(true)
    try {
      const selected = await pickInterviewProblem({ difficulty: difficulty || undefined, topic: topic || undefined })
      const limit = INTERVIEW_TIME_LIMITS_SECONDS[selected.difficulty]
      const opening = await getInterviewerOpening(selected)

      setProblem(selected)
      setTimeLimitSeconds(limit)
      setCodeByLanguage({ ...(selected.starterCode || DEFAULT_STARTER_CODE) })
      setHintsUsed(0)
      setConversation([])
      setSummary(null)
      setStartedAt(Date.now())
      setNow(Date.now())
      setPhase('session')
      setConversation([{ id: Date.now(), role: 'interviewer', content: opening }])
    } catch (error) { setActionError(error.message) }
    finally { setIsStarting(false) }
  }

  async function handleSendApproach() {
    const trimmed = approachText.trim()
    if (!trimmed || isInterviewerTyping) return

    setConversation((prev) => [...prev, { id: Date.now(), role: 'candidate', content: trimmed }])
    setApproachText('')
    setIsInterviewerTyping(true)
    try {
      const reply = await getInterviewerFollowUp(trimmed, { problem, conversation })
      setConversation((prev) => [...prev, { id: Date.now() + 1, role: 'interviewer', content: reply }])
    } catch (error) {
      setActionError(error.message)
    } finally {
      setIsInterviewerTyping(false)
    }
  }

  async function handleUseHint() {
    if (hintsUsed >= MAX_HINTS_PER_INTERVIEW || isInterviewerTyping) return
    setIsInterviewerTyping(true)
    try {
      const hint = await getControlledHint(problem)
      setHintsUsed((h) => h + 1)
      setConversation((prev) => [
        ...prev,
        { id: Date.now(), role: 'interviewer', content: `Hint (${hintsUsed + 1}/${MAX_HINTS_PER_INTERVIEW} used): ${hint.content}` },
      ])
    } catch (error) {
      setActionError(error.message)
    } finally {
      setIsInterviewerTyping(false)
    }
  }

  async function handleFinish() {
    setIsFinishing(true)
    try {
      const result = await finishInterview({
        problem,
        code: currentCode,
        language,
        timeTakenSeconds: elapsedSeconds,
        timeLimitSeconds,
        hintsUsed,
        conversation,
      })
      setSummary(result)
      setPhase('summary')
    } catch (error) {
      setActionError(error.message)
    } finally {
      setIsFinishing(false)
    }
  }

  function handleRestart() {
    setPhase('setup')
    setProblem(null)
    setSummary(null)
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Interview Mode</h1>
        <p className="mt-1 text-sm text-zinc-400">Timed practice with a live AI interviewer and a real submission judge.</p>
      </header>

      {actionError && <p role="alert" className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">{actionError}</p>}

      {phase === 'setup' && (
        <Panel title="Set up your interview">
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-300">Difficulty</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip label="Any" isActive={difficulty === ''} onClick={() => setDifficulty('')} />
                {DIFFICULTIES.map((d) => (
                  <FilterChip key={d} label={d} isActive={difficulty === d} onClick={() => setDifficulty(d)} />
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="topic-focus" className="mb-2 block text-sm font-medium text-zinc-300">
                Focus (this covers "company/topic mode" — see note below)
              </label>
              <select
                id="topic-focus"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-indigo-400"
              >
                <option value="">General (mixed topics)</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <p className="mt-2 max-w-md text-xs text-zinc-600">
                Real company-specific question banks aren't included here — there's no honest way to
                back that with a real source in this demo. "General" stands in for company-agnostic
                mode; picking a topic focuses the question instead.
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
              Questions come from problems with a complete statement, examples, and constraints. The
              current starter catalog has a limited pool; admins can add more complete problems. Final
              scoring also requires the problem to have configured test cases.
            </div>

            <Button onClick={handleStart} className="w-fit" disabled={isStarting}>
              {isStarting ? 'Preparing interview…' : 'Start Interview'}
            </Button>
          </div>
        </Panel>
      )}

      {phase === 'session' && problem && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center gap-2">
              <FiClock className={`h-4 w-4 ${isTimeUp ? 'text-red-400' : 'text-zinc-400'}`} />
              <span className={`font-mono text-lg ${isTimeUp ? 'text-red-400' : 'text-zinc-100'}`}>
                {formatDuration(remainingSeconds)}
              </span>
              <span className="text-xs text-zinc-600">remaining</span>
              {isTimeUp && <Badge tone="danger">Time's up</Badge>}
            </div>
            <Button onClick={handleFinish} disabled={isFinishing}>
              {isFinishing ? 'Scoring…' : 'Finish Interview'}
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Panel title={problem.title} action={<Badge tone={toneForDifficulty(problem.difficulty)}>{problem.difficulty}</Badge>}>
                <p className="text-sm text-zinc-300">{problem.description}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {problem.examples.slice(0, 1).map((example, index) => (
                    <div key={index} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-xs">
                      <p className="text-zinc-400">
                        Input: <span className="text-zinc-200">{example.input}</span>
                      </p>
                      <p className="text-zinc-400">
                        Output: <span className="text-zinc-200">{example.output}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="AI Interviewer" action={<Badge tone="ai">AI</Badge>}>
                <div className="mb-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {conversation.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                        message.role === 'candidate' ? 'ml-auto bg-amber-400/10 text-zinc-100' : 'bg-zinc-950/60 text-zinc-300'
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                  {isInterviewerTyping && <p className="text-xs text-zinc-600">Interviewer is typing…</p>}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={approachText}
                    onChange={(e) => setApproachText(e.target.value)}
                    maxLength={1500}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendApproach()
                    }}
                    placeholder="Explain your approach…"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    disabled
                    title="Voice responses are planned but not implemented in this demo"
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-600 disabled:cursor-not-allowed"
                  >
                    <FiMic className="h-4 w-4" />
                  </button>
                  <Button variant="ai" onClick={handleSendApproach} disabled={isInterviewerTyping}>
                    Send
                  </Button>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3">
                  <Button
                    variant="secondary"
                    onClick={handleUseHint}
                    disabled={hintsUsed >= MAX_HINTS_PER_INTERVIEW || isInterviewerTyping}
                  >
                    Ask for a hint ({hintsUsed}/{MAX_HINTS_PER_INTERVIEW} used)
                  </Button>
                  <span className="text-xs text-zinc-600">Hints are limited on purpose — real interviews notice over-reliance on them.</span>
                </div>
              </Panel>
            </div>

            <Panel title="Your code">
              <CodeEditor
                language={language}
                onLanguageChange={setLanguage}
                theme={theme}
                onThemeChange={setTheme}
                code={currentCode}
                onCodeChange={(value) => setCodeByLanguage((prev) => ({ ...prev, [language]: value }))}
                onReset={() => setCodeByLanguage((prev) => ({ ...prev, [language]: starterCode[language] }))}
              />
            </Panel>
          </div>
        </>
      )}

      {phase === 'summary' && summary && problem && (
        <div className="flex flex-col gap-4">
          <Panel
            title="Performance summary"
            action={
              <Badge tone={summary.executionResult.status === 'Accepted' ? 'success' : 'danger'}>
                {summary.executionResult.status}
              </Badge>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-zinc-500">Problem</p>
                <p className="text-sm text-zinc-200">{problem.title}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Time used</p>
                <p className={`text-sm ${summary.withinTime ? 'text-zinc-200' : 'text-red-300'}`}>
                  {formatDuration(elapsedSeconds)} / {formatDuration(timeLimitSeconds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Hints used</p>
                <p className="text-sm text-zinc-200">
                  {hintsUsed}/{MAX_HINTS_PER_INTERVIEW}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Hidden tests</p>
                <p className="text-sm text-zinc-200">
                  {summary.executionResult.passedTests}/{summary.executionResult.totalTests}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="AI interview feedback" action={<Badge tone="ai">AI</Badge>}>
            {summary.isMock && (
              <Badge tone="neutral" className="mb-3">
                MOCK RESPONSE
              </Badge>
            )}
            <div className="flex flex-col gap-4">
              <ReviewSection title="Communication" content={summary.feedback.communication} />
              <ReviewSection title="Problem-Solving Approach" content={summary.feedback.problemSolving} />
              <ReviewSection title="Code Quality" content={summary.feedback.codeQuality} />
              <ReviewSection title="Improvement Tip" content={summary.feedback.improvementTip} />
            </div>
          </Panel>

          <Button onClick={handleRestart} className="w-fit">
            <FiAward className="h-4 w-4" /> Start another interview
          </Button>
        </div>
      )}
    </div>
  )
}

export default Interview
