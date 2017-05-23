var Conf = {} // will be available to pipe
let State = {conns: [], count: 0, init: 0, render: ''}
let ErrorReport = document.getElementById('error')
let Report = document.getElementById('report')
let Serializer = new XMLSerializer;

// NB: mainly for debugging
window.VZIConf = Conf;
window.VZIState = State;

/* This is the glue between the input formats / events.
 */

var render_lines = (data, doc, buf, sep) => {
  const lines = (buf + data).split('\n')
  const final = lines.pop() // either empty (if complete) or leftover
  for (let line of lines) {
    Report.contentWindow.render_event(line.split(sep), doc, State.count++)
    document.title = `vzi (${State.count} in ${State.init})`
  }
  return data.endsWith('\n') ? '' : final;
}

/* This API is needed to bootstrap and communicate with the page.
 * The driver calls the handle_* callbacks using the DevTools protocol.
 */

function report(always = true) {
  if (always || Conf.always) {
    // NB: force serialize style elements (TODO: canvas too?)
    let doc = Report.contentDocument;
    for (let s of doc.getElementsByTagName('style'))
      s.textContent = Array.prototype.map.call(s.sheet.rules, ((r) => r.cssText)).join('\n')
    return `<!DOCTYPE html>\n${doc.children[0].outerHTML}\n`
  }
}

function handle_init(conf, seed) {
  const {pipe} = Conf = conf;
  let doc = Report.contentDocument, win = Report.contentWindow;
  let script = doc.createElement('script')
  script.id = 'pipe-js'
  script.text = `
/* This API can/should be overridden by user-defined functions.
 * It is often enough to simply overwrite \`render_event\`.
 */
window.render_begin = (doc, init, seed) => {}
window.render_event = (event, doc, i) => doc.body.innerText = event;
window.export_state = (doc) => doc.body.outerHTML;
window.onload = () => render_begin(document, 0, ${JSON.stringify(seed)})
Conf = ${JSON.stringify(Conf)};
`
  try {
    for (let mode of ['file', 'cli', 'module'])
      if (pipe[mode])
        script.text += `${pipe[mode]};`
    if (doc.getElementById('pipe-js'))
      doc.body.removeChild(doc.getElementById('pipe-js'))
    doc.body.appendChild(script)
    win.render_begin(doc, State.init++, seed)
  } catch (e) {
    ErrorReport.innerText = `Error evaluating pipe: ${e}`
    console.error(e)
  }
  return report()
}

function handle_data(enc) {
  if (State.init) { // NB: when streaming, make sure clients init first
    const data = atob(enc)
    try {
      switch (Conf.format) {
      case 'unix':
      default:
        State.sep = State.sep || new RegExp(Conf.separator || '\\s+')
        State.render = render_lines(data, Report.contentDocument, State.render, State.sep)
        break;
      }
    } catch (e) {
      ErrorReport.innerText = `Error evaluating data: ${e}`
      console.error(e)
    }
    State.conns.map((conn) => conn.open && conn.send(`handle_data("${enc}")`))
  }
  return report(false)
}

function handle_done() {
  if (State.init) { // NB: when streaming, make sure clients init first
    State.conns.map((conn) => conn.open && conn.send(`handle_done()`))
  }
  return report()
}

/* Adds "share" functionality via WebRTC.
 * NB: Experimental and may not very be useful as is.
 */

((doc, api_key, share_url) => {
  let script = doc.createElement('script')
  script.type = 'text/javascript'
  script.async = true;
  script.src = 'http://cdn.peerjs.com/0.3/peer.js'
  script.onload = () => {
    let me = new Peer({key: api_key})
    let hash = doc.location.hash.substr(1)
    let share = doc.getElementById('share')
    let badge = () => {
      let N = State.conns.length;
      share.innerText = N  ? `share (${N})` : 'share'
    }
    if (hash.startsWith('host=')) { // given host
      let host = hash.split('=')[1]
      let conn = me.connect(host, {reliable: true})
      me.on('open', () => share.href = `${share_url}#host=${host}`)
      conn.on('data', (data) => eval(data))
    } else {                        // I am host
      me.on('open', (id) => share.href = `${share_url}#host=${id}`)
      me.on('connection', (conn) => {
        State.conns.push(conn)
        badge()
        conn.on('open', () => {
          // other messages sent when they occur, but init can be missed
          // in general the handle_init function should be idempotent
          // since e.g. when reusing a page, it will be called again
          let seed = Report.contentWindow.export_state(Report.contentDocument)
          conn.send(`handle_init(${JSON.stringify(Conf)}, ${JSON.stringify(seed)})`)
        })
        conn.on('close', () => {
          let i = State.conns.indexOf(conn)
          if (i >= 0) {
            State.conns.splice(i, 1)
            badge()
          }
        })
        conn.on('error', (e) => console.error(e))
      })
    }
  }
  doc.head.appendChild(script)
})(document, 'wye3ak7fgi5ghkt9', 'http://jflatow.github.io/vzi/www')
