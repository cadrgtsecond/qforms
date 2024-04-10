import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { html } from 'hono/html';
import { FC } from 'hono/jsx';
import postgres from 'postgres';

const app = new Hono();
const sql = postgres({});

app.use('/css/*', serveStatic({ root: './' }));

interface Question {
  id: number,
  desc: string,
  options: string[],
}

const Question: FC<Question> = ({id, desc, options}) =>
<form hx-trigger="click" hx-get={`/questions/${id}/edit`} hx-swap="outerHTML" class="question-box">
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
        {questions.map((q) => <li><Question desc={q.desc} id={q.id} options={[]}/></li>)}
      </ul>
      <button hx-post="/questions" hx-target="#questions" hx-swap="beforeend" class="material-symbols-outlined">
        add
      </button>
    </body>
  </html>
</>;

async function fetchQuestions(): Promise<Question[]> {
  const res = await sql`select id,description
                          from questions
                          order by ord asc`;
  return res.map(q => ({desc: q.description, id: q.id}));
}

app.get('/', async (c) => {
  // Only one count guaranteed since name is primary key
  return c.html(<Index questions={await fetchQuestions()}/>);
});

async function createQuestion(desc: string): Promise<number> {
  const [{id}] = await sql`insert into questions (description, ord)
                             values (${desc}, (select coalesce(max(ord), 0) + 1 from questions))
                             returning id`;
  return id;
}

app.post('/questions', async (c) => {
  const {description} = await c.req.parseBody<{description: string}>();
  const desc = description || 'Question';
  const id = await createQuestion(desc);

  return c.html(<li><Question id={id} desc={desc} options={[]}/></li>);
});

app.get('/questions/:id/heading', async (c) => {
  const id = parseInt(c.req.param('id'));
  const res = await sql`select description from questions where id = ${id}`;
  if(res.length == 0) {
    return c.notFound();
  }
  return c.html(<Question id={id} desc={res[0].description} options={[]}/>);
});
app.post('/questions/:id/heading', async (c) => {
  const id = parseInt(c.req.param('id'));
  const {desc}: {desc: string} = await c.req.parseBody();
  await sql`update questions
             set description = ${desc}
             where id = ${id}`;
  return c.html(<Question id={id} desc={desc} options={[]}/>);
});

const QuestionEdit: FC<Question> = ({desc, id}) =>
<form hx-post={`/questions/${id}/heading`}
      hx-target="this"
      hx-swap="outerHTML"
      class="question-box">
  <div class="heading">
    <input class="desc" name="desc" value={desc} autofocus/>
    <button type="submit" class="material-symbols-outlined">
      done
    </button>
    <button hx-get={`/questions/${id}/heading`}
            hx-trigger="click, keyup[key == 'Escape'] from:closest form"
            class="material-symbols-outlined">
      close
    </button>
  </div>
  <button class="material-symbols-outlined">
    add
  </button>
</form>;
app.get('/questions/:id/edit', async (c) => {
  const id = parseInt(c.req.param('id'));
  const desc = c.req.query('desc') || '';
  return c.html(<QuestionEdit id={id} desc={desc} options={[]}/>);
});


export default app;
