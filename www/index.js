let Opts = {}, RenderState = ''
let Report = document.getElementById('report')
let Serializer = new XMLSerializer;

/* This API can/should be overridden by user-defined functions.
 * It is often enough to simply overwrite `render_event`.
 */

var render_begin = (doc) => {}
var render_event = (event, doc) => doc.body.innerText = event;
var render_lines = (data, doc, opts, state) => {
  const lines = (state + data).split('\n')
  const final = lines.pop() // either empty (if complete) or leftover
  for (let event of lines)
    render_event(event, doc, opts)
  return data.endsWith('\n') ? '' : final;
}

/* This API is needed to bootstrap the page.
 * It can be overwritten though too, if you know what you are doing.
 */

function report() {
  return Serializer.serializeToString(Report.contentDocument) + '\n'
}

function handle_init(opts) {
  const pipe = opts.pipe;
  for (let mode of ['file', 'cli', 'module'])
    if (pipe[mode])
      try {
        let code = eval(pipe[mode])
        render_begin(Report.contentDocument)
      } catch (e) {
        Report.contentDocument.body.innerText = `Error evaluating ${mode}: ${e}`
        console.error(e)
      }
  Opts = opts
  return report()
}

function handle_data(enc) {
  const data = atob(enc)
  switch (Opts.format) {
  case 'unix':
  default:
    RenderState = render_lines(data, Report.contentDocument, Opts, RenderState)
    break;
  }
  return report()
}

function handle_done() {
  console.debug('done')
  return report()
}
