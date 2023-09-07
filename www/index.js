// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

let Conf = {}; // will be available to pipe
const State = { conns: [], count: 0, init: 0, render: '' };
const ErrorReport = document.getElementById('error');
const Report = document.getElementById('report');
const Serializer = new XMLSerializer;

// NB: mainly for debugging
window.VZIConf = Conf;
window.VZIState = State;

/* This is the glue between the input formats / events.
 */

function render_lines(data, doc, buf, sep) {
  const lines = (buf + data).split('\n');
  const final = lines.pop(); // either empty (if complete) or leftover
  for (const line of lines) {
    Report.contentWindow.render_event(line.split(sep), doc, State.count++);
    document.title = `vzi (${State.count} in ${State.init})`;
  }
  return data.endsWith('\n') ? '' : final;
}

/* This API is needed to bootstrap and communicate with the page.
 * The driver calls the handle_* callbacks using the DevTools protocol.
 */

function report(always = true) {
  if (always || Conf.always) {
    // NB: force serialize style elements (TODO: canvas too?)
    const doc = Report.contentDocument;
    for (const s of doc.getElementsByTagName('style'))
      s.textContent = Array.prototype.map.call(s.sheet.rules, ((r) => r.cssText)).join('\n');
    return `<!DOCTYPE html>\n${Report.contentWindow.export_state(doc)}\n`;
  }
}

function handle_init(conf, seed) {
  const { pipe } = Conf = conf;
  const doc = Report.contentDocument, win = Report.contentWindow;
  const script = doc.createElement('script');
  script.id = 'pipe-js';
  script.text = `
/* This API can/should be overridden by user-defined functions.
 * It is often enough to simply overwrite \`render_event\`.
 */
window.render_begin = (doc, init, seed) => {};
window.render_event = (event, doc, i) => doc.body.innerText = event;
window.export_state = (doc) => doc.children[0].outerHTML;
window.onload = () => render_begin(document, 0, ${JSON.stringify(seed)});
window.Conf = ${JSON.stringify(Conf)};
window.vziAutoExport = true;
`
  try {
    for (const mode of ['file', 'cli', 'module'])
      if (pipe[mode])
        script.text += `${pipe[mode]};`;
    if (doc.getElementById('pipe-js'))
      doc.body.removeChild(doc.getElementById('pipe-js')); // Q: on body or head?
    doc.body.appendChild(script);
    win.render_begin(doc, State.init++, seed);
  } catch (e) {
    ErrorReport.innerText = `Error evaluating pipe: ${e}`;
    console.error(e);
  }
  return report();
}

function handle_data(enc) {
  if (State.init) { // NB: when streaming, make sure clients init first
    const data = atob(enc);
    try {
      switch (Conf.format) {
      case 'unix':
      default:
        State.sep = State.sep || new RegExp(Conf.separator || '\\s+');
        State.render = render_lines(data, Report.contentDocument, State.render, State.sep);
        break;
      }
    } catch (e) {
      ErrorReport.innerText = `Error evaluating data: ${e}`;
      console.error(e);
    }
    State.conns.map((conn) => conn.open && conn.send(`handle_data("${enc}")`));
  }
  return report(false);
}

function handle_done() {
  if (State.init) { // NB: when streaming, make sure clients init first
    State.conns.map((conn) => conn.open && conn.send(`handle_done()`));
  }
  return report();
}
