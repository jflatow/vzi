let Conf = {}, Count = 0, Rate = 0, RenderState = ''
let Error = document.getElementById('error')
let Report = document.getElementById('report')
let Serializer = new XMLSerializer;

/* This API can/should be overridden by user-defined functions.
 * It is often enough to simply overwrite `render_event`.
 */

var render_begin = (doc, conf) => {}
var render_event = (event, doc, i) => doc.body.innerText = event;
var render_lines = (data, doc, state) => {
  const lines = (state + data).split('\n')
  const final = lines.pop() // either empty (if complete) or leftover
  for (let event of lines)
    render_event(event, doc, Count++)
  return data.endsWith('\n') ? '' : final;
}

/* This API is needed to bootstrap the page.
 * It can be overwritten though too, if you know what you are doing.
 */

function report() {
  return Serializer.serializeToString(Report.contentDocument) + '\n'
}

function handle_init(conf) {
  const {pipe} = Conf = conf;
  for (let mode of ['file', 'cli', 'module'])
    if (conf.pipe[mode])
      try {
        let code = eval(conf.pipe[mode])
        render_begin(Report.contentDocument, conf)
      } catch (e) {
        Error.innerText = `Error evaluating ${mode}: ${e}`
        console.error(e)
      }
  return report()
}

function handle_data(enc) {
  const data = atob(enc)
  try {
    switch (Conf.format) {
    case 'unix':
    default:
      RenderState = render_lines(data, Report.contentDocument, RenderState)
      break;
    }
  } catch (e) {
    Error.innerText = `Error evaluating data: ${e}`
    console.error(e)
  }
  return report()
}

function handle_done() {
  console.debug('done')
  return report()
}
