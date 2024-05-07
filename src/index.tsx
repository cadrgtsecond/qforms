import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { html } from 'hono/html'
import { FC } from 'hono/jsx'
import questions, { Question } from './questions'
import QuestionEl from './Question'
import sql from './sql'

const app = new Hono()
const SESSION_SECRET = process.env.SESSION_SECRET
if (SESSION_SECRET === undefined) {
  throw new Error('SESSION_SECRET should be defined')
}

app.use('/css/*', serveStatic({ root: './' }))

const Index: FC<{ questions: Question[] }> = ({ questions }) => (
  <>
    {html`<!doctype html>`}
    <html>
      <head>
        <title>QForm</title>
        <meta
          name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1.0"
        />
        <script
          src="https://unpkg.com/htmx.org@1.9.11"
          integrity="sha384-0gxUXCCR8yv9FM2b+U3FDbsKthCI66oH5IA9fHppQq9DDMHuMauqq1ZHBpJxQ0J0"
          crossorigin="anonymous"
        ></script>
        <script src="https://unpkg.com/htmx.org@1.9.11/dist/ext/path-params.js" />
        <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
          rel="stylesheet"
        />
        <link href="/css/index.css" rel="stylesheet" />
        <script type="text/hyperscript">
          init repeat forever trigger save on {html`<body />`}
          wait 2s end behavior SortableList(handle) init make a Sortable from
          me, {'{'}
          animation: 150, handle: handle
          {'}'}
          end
        </script>
        <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
      </head>
      <body hx-ext="path-params">
        <ul
          _="install SortableList(handle: '.handle')"
          hx-put="/questions"
          hx-trigger="end"
          hx-swap="none"
          hx-include="input[name='question_id']"
          hx-disinherit="hx-include"
          id="questions"
          class="question-list"
        >
          {questions.map((q) => (
            <li>
              <QuestionEl {...q} />
            </li>
          ))}
        </ul>
        <button
          hx-post="/questions"
          hx-target="#questions"
          hx-swap="beforeend"
          class="material-symbols-outlined"
        >
          add
        </button>
      </body>
    </html>
  </>
)

async function fetchQuestions(): Promise<Question[]> {
  const questions: { id: number; description: string }[] =
    await sql`select id, description
                from questions
                order by ord asc`
  const options: {
    question: number
    description: string
    selected: boolean
  }[] = await sql`select question, ord, description, selected
                from options
                order by ord asc`
  const grouped = Object.groupBy(options, (e) => e.question)

  return questions.map(({ id, description: desc }) => ({
    id,
    desc,
    options: (grouped[id] ?? []).map(({ description, selected }) => ({
      selected,
      desc: description,
    })),
  }))
}

app.get('/', async (c) => {
  const main_page = <Index questions={await fetchQuestions()} />
  // Only one count guaranteed since name is primary key
  return c.html(main_page)
})

app.route('./questions', questions)
