import { OnLoadResultObject } from 'bun'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { html } from 'hono/html'
import { FC } from 'hono/jsx'
import postgres from 'postgres'

const app = new Hono()
const sql = postgres({})

app.use('/css/*', serveStatic({ root: './' }))

interface Question {
  id: number
  ord: number
  desc: string
  options: QuestionOption[]
}
interface QuestionOption {
  id: number
  desc: string
}

const Option: FC<QuestionOption & { question: number }> = ({
  question,
  id,
  desc,
}) => (
  <li>
    <input hx-put={`/questions/${question}/${id}`} name="option" value={desc} />
    <span class="handle material-symbols-outlined">drag_indicator</span>
  </li>
)
const Options: FC<{ options: QuestionOption[]; question: number }> = ({
  options,
  question,
}) => (
  <form>
    <ol
      _="install SortableList(handle: '.handle')
         on end halt the event"
      hx-put={`/questions/${question}`}
      hx-trigger="end"
      hx-swap="outerHTML"
      class="options"
    >
      {options.map((o) => (
        <Option id={o.id} desc={o.desc} question={question} />
      ))}
    </ol>
  </form>
)

const Question: FC<Question> = ({ id, desc, options }) => (
  <div class="question-box">
    <input type="hidden" name="question_id" value={id} />
    <div class="heading">
      <input
        hx-put={`/questions/${id}/heading`}
        hx-trigger="keyup changed delay:500ms, save changed from:body"
        class="desc"
        name="desc"
        value={desc}
      />
      <button
        hx-delete={`/questions/${id}`}
        hx-target="closest .question-box"
        hx-swap="outerHTML"
        class="material-symbols-outlined"
      >
        delete
      </button>
      <span class="handle material-symbols-outlined">drag_indicator</span>
    </div>
    <Options options={options} question={id} />
    <button
      hx-post={`/questions/${id}`}
      hx-target="previous .options"
      hx-swap="beforeend"
      class="material-symbols-outlined"
    >
      add
    </button>
  </div>
)

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
          {questions.map((q, i) => (
            <li>
              <Question desc={q.desc} id={q.id} ord={i} options={q.options} />
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
  const questions: { id: number; ord: number; description: string }[] =
    await sql`select id, ord, description
                from questions
                order by ord asc`
  const options: { question: number; ord: number; description: string }[] =
    await sql`select question, ord, description
                from options
                order by ord asc`
  const grouped = Object.groupBy(options, (e) => e.question)

  return questions.map(({ id, ord, description: desc }) => ({
    id,
    ord,
    desc,
    options: (grouped[id] ?? []).map(({ ord, description }) => ({
      id: ord,
      desc: description,
    })),
  }))
}

app.get('/', async (c) => {
  // Only one count guaranteed since name is primary key
  return c.html(<Index questions={await fetchQuestions()} />)
})

/*
 * Questions
 */

async function createQuestion(
  desc: string
): Promise<{ id: number; ord: number }> {
  const [{ id, ord }] = await sql`insert into questions (description, ord)
                                    values (${desc}, (select coalesce(max(ord) + 1, 0) from questions))
                                    returning id, ord`
  return { id, ord }
}

app.post('/questions', async (c) => {
  const desc = 'Question'
  const q = await createQuestion(desc)

  return c.html(
    <li>
      <Question {...q} desc={desc} options={[]} />
    </li>
  )
})
app.put('/questions', async (c) => {
  const body: { question_id: string[] } = await c.req.parseBody({ all: true })
  const q_ids = body.question_id.map((id, ord) => [parseInt(id), ord])
  await sql`update questions
              set ord = update_data.ord::int
              from (values ${sql(q_ids)}) as update_data (id, ord)
              where questions.id = update_data.id::int`
  return c.body('')
})

app.put('/questions/:id/heading', async (c) => {
  const id = parseInt(c.req.param('id'))
  const { desc }: { desc: string } = await c.req.parseBody()
  await sql`update questions
              set description = ${desc}
              where id = ${id}`
  // Unnecessary since input is already updated
  return c.body('')
})

app.delete('/questions/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await sql.begin(async (sql) => {
    await sql`delete from questions where id = ${id}`
    await sql`update questions set ord = questions.ord - 1
                from questions as old
                where questions.ord > old.ord and old.id = ${id}`
  })
  return c.body('')
})

/*
 * Options
 */
app.post('/questions/:id', async (c) => {
  const question = parseInt(c.req.param('id'))
  const desc: string = 'Option'
  const [{ ord }] = await sql`insert into options (question, description, ord)
                                values (${question},
                                        ${desc},
                                        (select coalesce(max(ord) + 1, 0)
                                          from options
                                          where question = ${question}))
                                returning ord`
  return c.html(<Option id={ord} desc={desc} question={question} />)
})

app.put('/questions/:question/:option', async (c) => {
  const question = c.req.param('question')
  const option = c.req.param('option')
  const body = await c.req.parseBody()
  const desc = body.option
  await sql`update options
              set description = ${desc}
              where question = ${question} and
                    ord = ${option}`
  // Unnecssary since input is already updated
  return c.body('')
})

app.put('/questions/:question', async (c) => {
  const question = c.req.param('question')
  const { option }: { option: string[] } = await c.req.parseBody({ all: true })
  sql.begin(async (sql) => {
    await sql`delete from options
                where question = ${question}`
    const data = option.map((desc, i) => [question, desc, i])
    await sql`insert into options (question, description, ord)
                values ${sql(data)}`
  })
})

export default app
