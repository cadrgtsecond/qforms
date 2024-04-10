import { Hono } from 'hono';
import { html } from 'hono/html';

const app = new Hono();

let count = 0;

const Count = ({count}) =>
  <h1 id="count">Count: {count}</h1>
;
const index = (count) =>
<>
  {html`<!DOCTYPE html>`}
  <html>
    <head>
      <title>QForm</title>
      <script src="https://unpkg.com/htmx.org@1.9.11" integrity="sha384-0gxUXCCR8yv9FM2b+U3FDbsKthCI66oH5IA9fHppQq9DDMHuMauqq1ZHBpJxQ0J0" crossorigin="anonymous"></script>
      <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1.0"/>
    </head>
    <body>
      <Count count={count}/>
      <button hx-post="/increment" hx-target="#count" hx-swap="outerHTML">+</button>
    </body>
  </html>
</>;

app.get('/', (c) => {
  return c.html(index(count));
});
app.post('/increment', (c) => {
  count += 1;
  return c.html(<Count count={count}/>);
});

export default app;
