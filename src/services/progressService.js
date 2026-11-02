import { apiRequest } from './apiClient.js'

export async function getMyProgress() {
  const result = await apiRequest('/api/progress/me')
  return {
    problemsSolved: result.problems_solved,
    accuracy: result.accuracy,
    totalAttempts: result.total_attempts,
    acceptedAttempts: result.accepted_attempts,
    currentStreak: result.current_streak,
    averageSolvingTimeSeconds: result.average_solving_time_seconds,
    difficultyDistribution: result.difficulty_distribution,
    solvingTimeTrend: result.solving_time_trend,
    topicMastery: result.topic_mastery,
    recentImprovements: result.recent_improvements,
  }
}

export async function getProgressRecommendations() {
  const result = await apiRequest('/api/progress/recommendations', { method: 'POST' })
  return result.recommendations
}
