import { OnLoadResultObject } from 'bun';
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
  options: QuestionOption[],
}
interface QuestionOption {
  ord: number,
  desc: string
}

const Option: FC<QuestionOption & {question: number}> = ({question, ord, desc}) => <li>
  <input hx-put={`/questions/${question}/${ord}`} name="options" value={desc}/>
</li>;
const Options: FC<{options: QuestionOption[], question: number}> = ({options, question}) => <ol class="options">
  {options.map(o => <Option ord={o.ord} desc={o.desc} question={question}/>)}
</ol>;

const Question: FC<Question> = ({ord, desc, options}) =>
<div hx-target="this"
     hx-swap="outerHTML"
     hx-trigger="input, save changed from:body"
     class="question-box">  
  <div class="heading">
    <input hx-put={`/questions/${ord}`}
           class="desc" name="desc" value={desc}/>
    <button hx-delete={`/questions/${ord}`} class="material-symbols-outlined">
      delete
    </button>
  </div>
  <Options options={options} question={ord}/>
  <button hx-post={`/questions/${ord}`}
          hx-target="previous .options"
          hx-swap="beforeend"
          class="material-symbols-outlined">
    add
  </button>
</div>;

const Index: FC<{questions: Question[]}> = ({questions}) => <>
  {html`<!DOCTYPE html>`}
  <html>
    <head>
      <title>QForm</title>
      <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1.0"/>
      <script src="https://unpkg.com/htmx.org@1.9.11" integrity="sha384-0gxUXCCR8yv9FM2b+U3FDbsKthCI66oH5IA9fHppQq9DDMHuMauqq1ZHBpJxQ0J0" crossorigin="anonymous"></script>
      <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
      <link href="/css/index.css" rel="stylesheet"/>
      <script type="text/hyperscript">
      init repeat forever
        trigger save on {html`<body/>`}
        wait 2s
      end
      </script>
    </head>
    <body>
      <ul id="questions" class="question-list">
        {questions.map((q) => <li><Question desc={q.desc} ord={q.ord} options={q.options}/></li>)}
      </ul>
      <button hx-post="/questions" hx-target="#questions" hx-swap="beforeend" class="material-symbols-outlined">
        add
      </button>
    </body>
  </html>
</>;

async function fetchQuestions(): Promise<Question[]> {
  const questions: {ord: number, description: string}[] =
    await sql`select ord, description
                from questions
                order by ord asc`;
  const options: {question: number, ord: number, description: string}[] =
    await sql`select question, ord, description
                from options
                order by ord asc`;
  const grouped = Object.groupBy(options, e => e.question);

  return questions.map(({ord, description}) => ({
    ord: ord,
    desc: description,
    options: (grouped[ord] ?? []).map(({ord, description}) => ({ord, desc: description})),
  }));
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

app.put('/questions/:ord', async (c) => {
  const ord = parseInt(c.req.param('ord'));
  const {desc}: {desc: string} = await c.req.parseBody();
  await sql`update questions
             set description = ${desc}
             where ord = ${ord}`;
  return c.html(<Question ord={ord} desc={desc} options={[]}/>);
});
app.delete('/questions/:ord', async (c) => {
  const ord = parseInt(c.req.param('ord'));
  await sql.begin(async sql => {
    await sql`delete from questions where ord = ${ord}`;
    await sql`update questions set ord = ord - 1 where ord > ${ord}`;
  })
  return c.body('');
});
app.post('/questions/:ord', async (c) => {
  const question = parseInt(c.req.param('ord'));
  const desc: string = `Option`;
  const [{ord}] =
    await sql`insert into options (question, description, ord)
                     values (${question},
                             ${desc},
                             (select coalesce(max(ord), 0) + 1
                               from options
                               where question = ${question}))
                     returning ord`;
  return c.html(<Option ord={ord} desc={desc}/>);
});

interface Option {
  value: string,
  ord: number,
}

export default app;
