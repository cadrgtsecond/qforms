import { FC } from 'hono/jsx'
import { Question, QuestionOption } from './questions'

const Option: FC<QuestionOption> = ({ desc, selected }) => (
  <li>
    <input type="radio" name="selected" checked={selected} />
    <input type="text" name="option" value={desc} />
    <button
      class="handle material-symbols-outlined"
      _="on click trigger save on the closest <form/> then remove the closest <li/>"
    >
      delete
    </button>
    <span class="handle material-symbols-outlined">drag_indicator</span>
  </li>
)
const OptionList: FC<{ options: QuestionOption[] }> = ({ options }) => (
  <ol
    _="install SortableList(handle: '.handle')
         def setSelectedValue()
           repeat in <input[name='selected']/> in me index i set its @value to i
         end
         on end halt the event then call setSelectedValue() then trigger save
         init call setSelectedValue()"
  >
    {options.map((o) => (
      <Option {...o} />
    ))}
  </ol>
)

export default (({ id, desc, options }) => (
  <form
    hx-put={`/questions/${id}`}
    hx-trigger="save delay:500ms, input delay:500ms"
    hx-params="not question_id"
    class="question-box"
  >
    <input type="hidden" name="question_id" value={id} />
    <div class="heading">
      <input class="desc" name="desc" value={desc} />
      <button
        hx-delete={`/questions/${id}`}
        hx-params="none"
        hx-target="closest .question-box"
        hx-swap="outerHTML"
        class="material-symbols-outlined"
      >
        delete
      </button>
      <span class="handle material-symbols-outlined">drag_indicator</span>
    </div>
    <OptionList options={options} />

    <template id="default-option">
      <Option desc="Option" selected={false} />
    </template>
    <button
      class="material-symbols-outlined"
      type="button"
      _={`on click put innerHTML of #default-option at the end of the previous <ol/>
                  then trigger save`}
    >
      add
    </button>
  </form>
)) satisfies FC<Question>
