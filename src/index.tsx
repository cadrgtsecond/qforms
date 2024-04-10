import { Hono } from 'hono';
import { html } from 'hono/html';
import { FC } from 'hono/jsx';
import postgres from 'postgres';

const app = new Hono();
const sql = postgres({});

interface Question {
  desc: string,
}

const Question: FC = ({desc}) => <p>{desc}</p>;

const Index: FC<{questions: Question[]}> = ({questions}) =>
<>
  {html`<!DOCTYPE html>`}
  <html>
    <head>
      <title>QForm</title>
      <script src="https://unpkg.com/htmx.org@1.9.11" integrity="sha384-0gxUXCCR8yv9FM2b+U3FDbsKthCI66oH5IA9fHppQq9DDMHuMauqq1ZHBpJxQ0J0" crossorigin="anonymous"></script>
      <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1.0"/>
    </head>
    <body>
      <ul id="questions">
        {questions.map((q) => <li><Question desc={q.desc}/></li>)}
      </ul>
      <form hx-post="/questions" hx-target="#questions" hx-swap="beforeend">
        <input type="text" name="description"/>
        <button type="submit">+</button>
      </form>
    </body>
  </html>
</>;

async function fetchQuestions(): Promise<Question[]> {
  const res = await sql`select description
                          from questions
                          order by ord asc`;
  console.log(res);
  return res.map(q => ({desc: q.description}));
}

app.get('/', async (c) => {
  // Only one count guaranteed since name is primary key
  return c.html(<Index questions={await fetchQuestions()}/>);
});

async function createQuestion(desc: string) {
  await sql`insert into questions (description, ord)
              values (${desc}, (select coalesce(max(ord), 0) + 1 from questions))`;

}

app.post('/questions', async (c) => {
  const {description} = await c.req.parseBody<{description: string}>();
  await createQuestion(description);

  return c.html(<li><Question desc={description}/></li>);
});

export default app;
