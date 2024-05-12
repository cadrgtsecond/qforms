import { Hono, Context } from 'hono'
import { serveStatic } from 'hono/bun'
import { setSignedCookie } from 'hono/cookie'
import { html } from 'hono/html'
import { Child, FC, PropsWithChildren } from 'hono/jsx'
import questions, { Question } from './questions'
import sql from './sql'
import pg, { Fragment } from 'postgres'
import { z } from 'zod'

const app = new Hono()
const SESSION_SECRET =
  process.env.SESSION_SECRET ??
  (() => {
    throw new Error('SESSION_SECRET should be defined')
  })()

app.use('/css/*', serveStatic({ root: './' }))

const Skeleton = ({
  children,
  extra_head,
}: {
  children: Child
  extra_head: Child
}) => (
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
        <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
          rel="stylesheet"
        />
        <link href="/css/index.css" rel="stylesheet" />
        <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
        {extra_head}
      </head>
      <body>{children}</body>
    </html>
  </>
)

const Index: FC<{ questions: Question[] }> = ({ questions }) => (
  <Skeleton
    extra_head={
      <script type="text/hyperscript">
        init repeat forever trigger save on {html`<body />`}
        wait 2s end behavior SortableList(handle) init make a Sortable from me,{' '}
        {'{'}
        animation: 150, handle: handle
        {'}'}
        end
      </script>
    }
  >
    <nav class="page-header">
      <h1>TestContent</h1>
    </nav>
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
          <Question {...q} />
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
  </Skeleton>
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

const LoginForm: FC<{ message?: string; targeturl: string }> = ({
  message,
  targeturl,
}) => (
  <Skeleton extra_head={<test>test</test>}>
    <form
      method="post"
      action={targeturl}
      hx-post={targeturl}
      hx-swap="none"
      class="signup-form"
    >
      <label for="username">username</label>
      <input type="text" name="username" id="username" required />
      <label for="password">password</label>
      <input type="password" name="password" id="password" required />
      <div id="messages">{message}</div>
      <button type="submit">Sign Up</button>
    </form>
  </Skeleton>
)

async function hx_redirect(c: Context, url: string) {
  if (c.req.header('HX-Request') === 'true') {
    c.header('HX-Location', url)
    return c.body('')
  }
  return c.redirect(url)
}

async function createSession(username: string) {
  const sessionid = crypto.getRandomValues(new Uint32Array(1))[0]
  await sql`insert into sessions (id, "user") values (${sessionid}, ${username})`
  return sessionid
}

async function authenticate(c: Context, session: number) {
  await setSignedCookie(c, 'session', String(session), SESSION_SECRET, {
    httpOnly: true,
    secure: true,
  })
}

app.get('/signup', async (c) => {
  return c.html(<LoginForm targeturl="/signup" />)
})
app.post('/signup', async (c) => {
  const body = z.object({ username: z.string(), password: z.string() })
  const { username, password } = body.parse(await c.req.parseBody())
  const pass_hashed = await Bun.password.hash(password)

  try {
    await sql`insert into users (name, pass) values (${username}, ${pass_hashed})`
    const session = await createSession(username)
    await authenticate(c, session)
  } catch (e) {
    if (e instanceof pg.PostgresError) {
      return c.html(
        <div id="messages" hx-swap-oob="true">
          <p>User already exists</p>
        </div>
      )
    }
    return c.html(
      <div id="messages" hx-swap-oob="true">
        <p>Unknown error</p>
      </div>
    )
  }
  hx_redirect(c, '/')
})

app.get('/login', async (c) => {
  return c.html(<LoginForm targeturl="/login" />)
})
app.post('/login', async (c) => {
  const body = z.object({ username: z.string(), password: z.string() })
  const { username, password } = body.parse(await c.req.parseBody())
  const [{ pass: expected_hash }]: { pass: string }[] =
    await sql`select pass from users where name = ${username}`
  if (!expected_hash) {
    return c.html(
      <div id="messages" hx-swap-oob="true">
        <p>Unknown user</p>
      </div>
    )
  }

  if (await Bun.password.verify(password, expected_hash)) {
    const session = await createSession(username)
    await authenticate(c, session)
  } else {
    return c.html(
      <div id="messages" hx-swap-oob="true">
        <p>Wrong password</p>
      </div>
    )
  }
  hx_redirect(c, '/')
})
export default app
