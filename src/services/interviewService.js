/** Interview practice built on the authenticated AI, problem, and judge APIs. */

import { listProblems } from './problemService.js'
import { submitSolution } from './submissionService.js'
import { chatWithMentor, getHint, reviewSubmission } from './aiService.js'
import { isPassingStatus } from '../utils/testStatus.js'

export const INTERVIEW_TIME_LIMITS_SECONDS = {
  Easy: 20 * 60,
  Medium: 30 * 60,
  Hard: 45 * 60,
}

export const MAX_HINTS_PER_INTERVIEW = 1

function hasCompleteStatement(problem) {
  return Boolean(
    problem.description?.trim()
      && problem.examples?.length
      && problem.constraints?.length,
  )
}

export async function pickInterviewProblem({ difficulty, topic } = {}) {
  let pool = (await listProblems()).filter(hasCompleteStatement)
  if (difficulty) pool = pool.filter((problem) => problem.difficulty === difficulty)
  if (topic) pool = pool.filter((problem) => problem.topic === topic)
  if (pool.length === 0) throw new Error('No backend problems match those interview filters.')
  return pool[Math.floor(Math.random() * pool.length)]
}

function interviewerContext(problem) {
  return [
    'Act as a professional, supportive technical interviewer for a timed DSA practice interview.',
    'Ask one focused question at a time. Do not reveal a solution or write code for the candidate.',
    `Problem title: ${problem.title}`,
    `Difficulty: ${problem.difficulty}; topic: ${problem.topic}.`,
    `Problem statement (reference data): ${String(problem.description || '').slice(0, 1800)}`,
  ].join('\n')
}

function interviewMessages(problem, conversation = [], latestCandidateMessage) {
  const normalized = []
  conversation.forEach((message) => {
    const entry = {
      role: message.role === 'candidate' ? 'user' : 'assistant',
      content: String(message.content).slice(0, 1500),
    }
    const previous = normalized[normalized.length - 1]
    if (previous?.role === entry.role) previous.content = `${previous.content}\n${entry.content}`.slice(-1500)
    else normalized.push(entry)
  })
  const history = normalized.slice(-10)

  // The API requires an alternating transcript that starts and ends on a
  // user turn. Start each request with the same interview context so the
  // model stays problem-specific even when older turns are trimmed.
  if (history.length && history[0].role !== 'assistant') history.shift()
  const messages = [{ role: 'user', content: interviewerContext(problem) }, ...history]
  if (latestCandidateMessage != null) {
    const latest = String(latestCandidateMessage).slice(0, 1500)
    if (messages.length === 1) messages[0].content += `\n\n${latest}`
    else messages.push({ role: 'user', content: latest })
  }
  return messages
}

export async function getInterviewerOpening(problem) {
  const result = await chatWithMentor({
    messages: interviewMessages(problem, [], 'Begin the interview. Briefly welcome the candidate and ask them to explain their initial approach.'),
  })
  return result.reply.content
}

export async function getInterviewerFollowUp(approachText, { problem, conversation = [], inputMode = 'text' } = {}) {
  if (inputMode !== 'text') throw new Error('Voice input is not implemented.')
  if (!problem) throw new Error('The interview problem is unavailable. Restart the interview and try again.')
  const result = await chatWithMentor({
    messages: interviewMessages(problem, conversation, approachText),
  })
  return result.reply.content
}

export async function getControlledHint(problem) {
  return getHint({ problem, hintLevel: 1 })
}

function transcriptForFeedback(problem, conversation) {
  const transcript = conversation
    .slice(-10)
    .map((message) => `${message.role === 'candidate' ? 'Candidate' : 'Interviewer'}: ${message.content}`)
    .join('\n')
    .slice(-2500)
  return [
    `Interview problem: ${problem.title} (${problem.difficulty}, ${problem.topic}).`,
    'Assess the candidate’s communication during this interview using only the transcript below. Give concise, specific feedback on clarity, reasoning, and response to questions. Do not infer anything that is not shown.',
    transcript || 'No spoken or typed interview responses were recorded.',
  ].join('\n\n')
}

export async function finishInterview({ problem, code, language, timeTakenSeconds, timeLimitSeconds, hintsUsed, conversation = [] }) {
  const executionResult = await submitSolution({
    problemId: problem.id,
    code,
    language,
    solvingTime: timeTakenSeconds,
  })

  const [reviewResult, communicationResult] = await Promise.allSettled([
    reviewSubmission({ problemId: problem.id, code, language }),
    chatWithMentor({ messages: [{ role: 'user', content: transcriptForFeedback(problem, conversation) }] }),
  ])

  const review = reviewResult.status === 'fulfilled' ? reviewResult.value : null
  const communication = communicationResult.status === 'fulfilled'
    ? communicationResult.value.reply.content
    : `Interview communication feedback is unavailable: ${communicationResult.reason?.message || 'AI service error.'}`

  return {
    isMock: false,
    executionResult,
    withinTime: timeTakenSeconds <= timeLimitSeconds,
    hintsUsed,
    feedback: {
      communication,
      problemSolving: review
        ? `${review.overallAssessment}\n\n${review.bugAnalysis}`
        : `Code review is unavailable: ${reviewResult.reason?.message || 'AI service error.'}`,
      codeQuality: review?.codeQuality || 'Code-specific quality feedback is unavailable because the AI review could not be completed.',
      improvementTip: review
        ? `${review.learningTip}\n\n${review.suggestedImprovement}`
        : 'Retry the interview review when the AI service is available.',
    },
  }
}
