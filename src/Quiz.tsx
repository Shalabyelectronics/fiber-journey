import { useState } from 'react'

interface Q {
  id: string
  topic: string
  question: string
  options: string[]
  correct: number
  explanation: string
}

const QUESTIONS: Q[] = [
  {
    id: 'q1',
    topic: 'trigger',
    question: 'You call setCount(c => c + 1). What has happened immediately after this line runs, before anything else?',
    options: [
      'The DOM already shows the new count',
      'The component function has already re-run with the new value',
      'React has only SCHEDULED an update — the component is marked dirty, but nothing has re-run and nothing on screen changed',
      'The browser has repainted',
    ],
    correct: 2,
    explanation:
      'A state setter schedules work; it does not perform it. The re-render, the diff, and the DOM mutation all happen later in the cycle. This is also why reading state right after calling the setter still gives you the OLD value.',
  },
  {
    id: 'q2',
    topic: 'render-phase',
    question: 'What does the render phase actually do?',
    options: [
      'It mutates the DOM nodes that changed',
      'It calls your component functions and builds a new virtual DOM (plain JS objects) — the real DOM is not touched',
      'It paints the new UI to the screen',
      'It deletes the old Fiber tree and builds a fresh one',
    ],
    correct: 1,
    explanation:
      'Render = calling your functions. The output is a new tree of React elements (the virtual DOM). Zero DOM mutation happens here — which is why a render can be thrown away, restarted, or interrupted safely.',
  },
  {
    id: 'q3',
    topic: 'reconciliation',
    question: 'During reconciliation, React compares the new virtual DOM against…',
    options: [
      'the current browser DOM, reading it node by node',
      'the previous JSX source code',
      'nothing — React always replaces the whole tree',
      'the existing Fiber tree — created once at mount and updated in place ever since',
    ],
    correct: 3,
    explanation:
      'The Fiber tree is React’s persistent copy of what is currently on screen. It is NOT rebuilt each cycle and React does not read the browser DOM to diff — it diffs two of its own in-memory structures, which is fast.',
  },
  {
    id: 'q4',
    topic: 'commit-phase',
    question: 'Which statement about the commit phase is correct?',
    options: [
      'It is the only phase that mutates the real DOM, and it applies only the changes found by the diff',
      'It re-runs every component function one final time',
      'It paints the pixels to the screen itself',
      'It runs before reconciliation so React knows what to render',
    ],
    correct: 0,
    explanation:
      'Commit walks the effect list produced by reconciliation and performs exactly those DOM operations — insert, update, delete. Nothing else in the whole cycle touches the real DOM.',
  },
  {
    id: 'q5',
    topic: 'browser-paint',
    question: 'After React’s commit finishes, who actually puts the new pixels on the screen?',
    options: [
      'ReactDOM, in a second pass',
      'The browser — it recalculates style/layout for the mutated nodes and paints',
      'The Fiber tree',
      'The virtual DOM',
    ],
    correct: 1,
    explanation:
      'React’s job ends at DOM mutation. Style recalculation, layout (reflow), and paint are browser work that happens after JavaScript yields. React never draws pixels.',
  },
  {
    id: 'q6',
    topic: 're-renders',
    question: 'A parent component re-renders. Its child receives exactly the same props as before. By default, the child…',
    options: [
      'is skipped automatically because the props are equal',
      'only re-renders if it has its own state',
      'throws a warning about unnecessary renders',
      're-renders anyway — same props do NOT prevent it unless you opt in with React.memo (or similar)',
    ],
    correct: 3,
    explanation:
      'By default React re-renders the entire subtree below a re-rendering component. Prop equality is not checked unless you ask for it (React.memo, PureComponent). Usually that is fine: an unchanged child diffs to “no DOM work” anyway.',
  },
]

interface Answer {
  id: string
  question: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  topic: string
}

export function Quiz({ unlocked }: { unlocked: boolean }) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [finished, setFinished] = useState(false)

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-6 text-center">
        <h2 className="mb-2 text-sm tracking-[0.25em] text-emerald-600">▒ EXAM LOCKED</h2>
        <p className="text-xs text-emerald-700">
          Run the full cycle at least once (reach BROWSER PAINT) to unlock the 6-question exam.
        </p>
      </div>
    )
  }

  const choose = (i: number) => {
    if (picked !== null) return
    const q = QUESTIONS[idx]
    setPicked(i)
    setAnswers((a) => [
      ...a,
      {
        id: q.id,
        question: q.question,
        userAnswer: q.options[i],
        correctAnswer: q.options[q.correct],
        isCorrect: i === q.correct,
        topic: q.topic,
      },
    ])
  }

  const next = () => {
    if (idx + 1 >= QUESTIONS.length) {
      setFinished(true)
    } else {
      setIdx(idx + 1)
      setPicked(null)
    }
  }

  const retake = () => {
    setIdx(0)
    setPicked(null)
    setAnswers([])
    setFinished(false)
  }

  const downloadReport = () => {
    const correct = answers.filter((a) => a.isCorrect).length
    const report = {
      app: 'Fiber Journey',
      completedAt: new Date().toISOString(),
      score: {
        correct,
        total: QUESTIONS.length,
        percent: Math.round((correct / QUESTIONS.length) * 100),
      },
      questions: answers.map((a) => ({
        id: a.id,
        question: a.question,
        userAnswer: a.userAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        topic: a.topic,
      })),
      weakTopics: Array.from(new Set(answers.filter((a) => !a.isCorrect).map((a) => a.topic))),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fiber-journey-report-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (finished) {
    const correct = answers.filter((a) => a.isCorrect).length
    const percent = Math.round((correct / QUESTIONS.length) * 100)
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-6">
        <h2 className="mb-1 text-sm tracking-[0.25em] text-cyan-300 glow-text">EXAM COMPLETE</h2>
        <p className="mb-4 text-3xl text-emerald-300 glow-text">
          {correct}/{QUESTIONS.length} <span className="text-base text-emerald-600">({percent}%)</span>
        </p>
        <ul className="mb-5 space-y-1">
          {answers.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-xs">
              <span style={{ color: a.isCorrect ? '#34d399' : '#ef4444' }}>{a.isCorrect ? '✓' : '✗'}</span>
              <span className="text-emerald-200/80">
                {a.question}
                {!a.isCorrect && <span className="block text-[10px] text-emerald-600">topic to review: {a.topic}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadReport}
            className="rounded border border-cyan-500/70 bg-cyan-950/50 px-4 py-2 text-xs tracking-widest text-cyan-200 glow-text hover:bg-cyan-900/50"
          >
            ⬇ DOWNLOAD REPORT (.json)
          </button>
          <button
            onClick={retake}
            className="rounded border border-emerald-900 px-4 py-2 text-xs text-emerald-500 hover:border-emerald-600"
          >
            ↺ RETAKE
          </button>
        </div>
      </div>
    )
  }

  const q = QUESTIONS[idx]
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm tracking-[0.25em] text-cyan-300 glow-text">THE EXAM</h2>
        <span className="text-[10px] tracking-widest text-emerald-600">
          QUESTION {idx + 1}/{QUESTIONS.length} · {q.topic}
        </span>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-emerald-100">{q.question}</p>
      <div className="grid gap-2">
        {q.options.map((opt, i) => {
          let cls = 'border-emerald-900/70 text-emerald-300 hover:border-emerald-500'
          if (picked !== null) {
            if (i === q.correct) cls = 'border-emerald-400 bg-emerald-950/60 text-emerald-200'
            else if (i === picked) cls = 'border-red-500 bg-red-950/40 text-red-300'
            else cls = 'border-emerald-900/40 text-emerald-800'
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`rounded border px-3 py-2 text-left text-xs leading-relaxed transition-colors ${cls}`}
            >
              <span className="mr-2 text-emerald-600">{String.fromCharCode(97 + i)})</span>
              {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className="mt-4">
          <p className="border-l-2 border-cyan-500/60 pl-3 text-xs leading-relaxed text-cyan-200/90">
            {picked === q.correct ? '✓ correct — ' : '✗ not quite — '}
            {q.explanation}
          </p>
          <button
            onClick={next}
            className="mt-4 rounded border border-cyan-500/70 bg-cyan-950/50 px-4 py-2 text-xs tracking-widest text-cyan-200 glow-text hover:bg-cyan-900/50"
          >
            {idx + 1 >= QUESTIONS.length ? 'FINISH →' : 'NEXT QUESTION →'}
          </button>
        </div>
      )}
    </div>
  )
}
