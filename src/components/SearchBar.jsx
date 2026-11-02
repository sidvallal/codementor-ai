import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import Badge from './ui/Badge.jsx'
import { toneForDifficulty } from '../utils/difficulty.js'
import { listProblems } from '../services/problemService.js'

function SearchBar({ className = '' }) {
  const rootRef = useRef(null)
  const loadedRef = useRef(false)
  const requestRef = useRef(null)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [problems, setProblems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    if (!term) return []
    return problems
      .filter((problem) => [problem.title, problem.topic, problem.difficulty]
        .some((value) => value?.toLocaleLowerCase().includes(term)))
      .slice(0, 7)
  }, [problems, query])

  useEffect(() => {
    if (!isOpen) return undefined
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isOpen])

  function loadProblems() {
    if (loadedRef.current || requestRef.current) return
    setIsLoading(true)
    setError('')
    requestRef.current = listProblems()
      .then((items) => {
        setProblems(items)
        loadedRef.current = true
      })
      .catch((err) => setError(err.message || 'Could not load searchable problems.'))
      .finally(() => {
        requestRef.current = null
        setIsLoading(false)
      })
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }
    if (!isOpen || !results.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      navigate(`/problems/${results[activeIndex].id}`)
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        type="search"
        role="combobox"
        aria-label="Search problems"
        aria-autocomplete="list"
        aria-expanded={isOpen && Boolean(query.trim())}
        aria-controls="problem-search-results"
        aria-activedescendant={isOpen && results.length ? `problem-search-result-${activeIndex}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          setIsOpen(true)
        }}
        onFocus={() => {
          setIsOpen(true)
          loadProblems()
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search problems by title or topic"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-3 text-sm text-zinc-300 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none"
      />

      {isOpen && query.trim() && <div id="problem-search-results" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl">
        {isLoading ? <p className="px-3 py-3 text-xs text-zinc-500">Searching problems…</p> : error ? (
          <p role="alert" className="px-3 py-3 text-xs text-red-300">{error}</p>
        ) : results.length ? (
          <ul role="listbox" aria-label="Matching problems" className="max-h-80 overflow-y-auto py-1">
            {results.map((problem, index) => <li key={problem.id} id={`problem-search-result-${index}`} role="option" aria-selected={activeIndex === index}>
              <Link
                to={`/problems/${problem.id}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => { setIsOpen(false); setQuery('') }}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 ${activeIndex === index ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-zinc-100">{problem.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">{problem.topic}</span>
                </span>
                <Badge tone={toneForDifficulty(problem.difficulty)}>{problem.difficulty}</Badge>
              </Link>
            </li>)}
          </ul>
        ) : <p className="px-3 py-3 text-xs text-zinc-500">No problems match “{query.trim()}”.</p>}
      </div>}
    </div>
  )
}

export default SearchBar
