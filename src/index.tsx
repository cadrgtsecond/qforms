import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { html } from 'hono/html';
import { FC } from 'hono/jsx';
import postgres from 'postgres';

const app = new Hono();
const sql = postgres({});

app.use('/css/*', serveStatic({ root: './' }));

interface Question {
  ord: number,
  desc: string,
  options: string[],
}

const Question: FC<Question> = ({ord, desc, options}) =>
<form hx-get={`/questions/${ord}/edit`}
      hx-trigger="click"
      hx-swap="outerHTML"
      class="question-box">
  <div class="heading">
    <span class="desc">{desc}</span>
    <input type="hidden" name="desc" value={desc}/>
  </div>
  {options.length == 0 ? <p>&lt;no options&gt;</p>
                       : <p>TODO</p>}
</form>;

const Index: FC<{questions: Question[]}> = ({questions}) => <>
  {html`<!DOCTYPE html>`}
  <html>
    <head>
      <title>QForm</title>
      <script src="https://unpkg.com/htmx.org@1.9.11" integrity="sha384-0gxUXCCR8yv9FM2b+U3FDbsKthCI66oH5IA9fHppQq9DDMHuMauqq1ZHBpJxQ0J0" crossorigin="anonymous"></script>
      <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1.0"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
      <link href="/css/index.css" rel="stylesheet"/>
    </head>
    <body>
      <ul id="questions" class="question-list">
        {questions.map((q) => <li><Question desc={q.desc} ord={q.ord} options={[]}/></li>)}
      </ul>
      <button hx-post="/questions" hx-target="#questions" hx-swap="beforeend" class="material-symbols-outlined">
        add
      </button>
    </body>
  </html>
</>;

async function fetchQuestions(): Promise<Question[]> {
  const res = await sql`select ord, description
                          from questions
                          order by ord asc`;
  return res.map(q => ({desc: q.description, ord: q.ord}));
}

app.get('/', async (c) => {
  // Only one count guaranteed since name is primary key
  return c.html(<Index questions={await fetchQuestions()}/>);
});

async function createQuestion(desc: string): Promise<number> {
  const [{ord}] = await sql`insert into questions (description, ord)
                             values (${desc}, (select coalesce(max(ord), 0) + 1 from questions))
                             returning ord`;
  return ord;
}

app.post('/questions', async (c) => {
  const {description} = await c.req.parseBody<{description: string}>();
  const desc = description || 'Question';
  const ord = await createQuestion(desc);

  return c.html(<li><Question ord={ord} desc={desc} options={[]}/></li>);
});

app.get('/questions/:ord', async (c) => {
  const ord = parseInt(c.req.param('ord'));
  const res = await sql`select description from questions where ord = ${ord}`;
  if(res.length == 0) {
    return c.notFound();
  }
  return c.html(<Question ord={ord} desc={res[0].description} options={[]}/>);
});
app.post('/questions/:ord', async (c) => {
  const ord = parseInt(c.req.param('ord'));
  const {desc}: {desc: string} = await c.req.parseBody();
  await sql`update questions
             set description = ${desc}
             where ord = ${ord}`;
  return c.html(<Question ord={ord} desc={desc} options={[]}/>);
});
app.delete('/questions/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  await sql`delete from questions where id = ${id}`;
  return c.body('');
});

const QuestionEdit: FC<Question> = ({desc, ord}) =>
<form hx-target="this"
      hx-swap="outerHTML"
      class="question-box">
  <div class="heading">
    <input class="desc" name="desc" value={desc} autofocus/>
    <button hx-post={`/questions/${ord}`} class="material-symbols-outlined">
      done
    </button>
    <button hx-get={`/questions/${ord}`}
            hx-trigger="click, keyup[key == 'Escape'] from:closest form"
            class="material-symbols-outlined">
      close
    </button>
    <button hx-delete={`/questions/${ord}`} class="material-symbols-outlined">
      delete
    </button>
  </div>
  <button class="material-symbols-outlined">
    add
  </button>
</form>;
app.get('/questions/:ord/edit', async (c) => {
  const ord = parseInt(c.req.param('ord'));
  const desc = c.req.query('desc') || '';
  return c.html(<QuestionEdit ord={ord} desc={desc} options={[]}/>);
});


export default app;
