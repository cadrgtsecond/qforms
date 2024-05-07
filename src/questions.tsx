import { Hono } from 'hono'
import { z } from 'zod'
import sql from './sql'
import Question from './Question'

const app = new Hono()
/// Useful function like z.array() that coerces single elements to arrays
const z_coerce_array = (inner: any) =>
  z.preprocess((a) => (Array.isArray(a) ? a : [a]), z.array(inner))

export interface Question {
  id: number
  desc: string
  options: QuestionOption[]
}
export interface QuestionOption {
  desc: string
  selected: boolean
}
async function createQuestion(
  desc: string
): Promise<{ id: number; ord: number }> {
  const [{ id, ord }] = await sql`insert into questions (description, ord)
                                    values (${desc}, (select coalesce(max(ord) + 1, 0) from questions))
                                    returning id, ord`
  return { id, ord }
}

app.post('/', async (c) => {
  const desc = 'Question'
  const q = await createQuestion(desc)

  return c.html(
    <li>
      <Question {...q} desc={desc} options={[]} />
    </li>
  )
})
app.put('/', async (c) => {
  const body = z.object({ question_id: z_coerce_array(z.coerce.number()) })
  const { question_id } = body.parse(await c.req.parseBody({ all: true }))
  await sql`update questions
              set ord = new_ord
              from (select generate_series(1,${question_id.length}) as new_ord, unnest(${question_id}::int[]) as update_id)
              where questions.id = update_id`
  return c.body('')
})

app.delete('/:id', async (c) => {
  const id = z.coerce.number().parse(c.req.param('id'))
  await sql.begin(async (sql) => {
    await sql`delete from questions where id = ${id}`
    await sql`update questions set ord = questions.ord - 1
                from questions as old
                where questions.ord > old.ord and old.id = ${id}`
  })
  return c.body('')
})

app.put('/questions/:question', async (c) => {
  const body = z.object({
    option: z_coerce_array(z.string()),
    desc: z.string(),
    selected: z.coerce.number().optional(),
  })
  const question = c.req.param('question')
  const { option, desc, selected } = body.parse(
    await c.req.parseBody({ all: true })
  )
  sql.begin(async (sql) => {
    // Change heading
    await sql`update questions
                set description = ${desc}
                where id = ${question}`

    // Update Options
    await sql`delete from options
                where question = ${question}`
    const data = option.map((desc, i) => [question, desc, i, i === selected])
    await sql`insert into options (question, description, ord, selected)
                values ${sql(data)}`
  })
  return c.body('')
})

export default app
