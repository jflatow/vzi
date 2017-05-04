let Conf = {}, State = {conns: [], count: 0}
let ErrorReport = document.getElementById('error')
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
    render_event(event, doc, State.count++)
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
        ErrorReport.innerText = `Error evaluating ${mode}: ${e}`
        console.error(e)
      }
  State.initialized = true;
  return report()
}

function handle_data(enc) {
  if (State.initialized) { // NB: when streaming, make sure clients init first
    const data = atob(enc)
    try {
      switch (Conf.format) {
      case 'unix':
      default:
        State.render = render_lines(data, Report.contentDocument, State.render)
        break;
      }
    } catch (e) {
      ErrorReport.innerText = `Error evaluating data: ${e}`
      console.error(e)
    }
    State.conns.map((conn) => conn.send(`handle_data("${enc}")`))
  }
  return report()
}

function handle_done() {
  if (State.initialized) { // NB: when streaming, make sure clients init first
    State.conns.map((conn) => conn.send(`handle_done()`))
  }
  return report()
}

((doc, api_key, share) => {
  let script = doc.createElement('script')
  script.type = 'text/javascript'
  script.async = true;
  script.src = 'http://cdn.peerjs.com/0.3/peer.js'
  script.onload = () => {
    let me = new Peer({key: api_key})
    let hash = doc.location.hash.substr(1)
    if (hash.startsWith('host=')) { // given host
      let host = hash.split('=')[1]
      let conn = me.connect(host, {reliable: true, debug: true})
      conn.on('data', (data) => eval(data))
    } else {                        // I am host
      me.on('open', (id) => {
        doc.getElementById('share').href = `${share}#host=${id}`
      })
      me.on('connection', (conn) => {
        State.conns.push(conn);
        conn.on('open', () => {
          // other messages sent when they occur, but init can be missed
          // in general the handle_init function should be idempotent
          // since e.g. when reusing a page, it will be called again
          conn.send(`handle_init(${JSON.stringify(Conf)})`)
        })
        conn.on('close', () => {
          let i = State.conns.indexOf(conn)
          if (i >= 0)
            State.conns.splice(i, 1)
        })
        conn.on('error', (e) => console.error(e))
      })
    }
  }
  doc.getElementsByTagName('head')[0].appendChild(script)
})(document, 'wye3ak7fgi5ghkt9', 'http://jflatow.github.io/vzi/www')
