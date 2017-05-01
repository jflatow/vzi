const Sky = require('sky')
const pad = (s, w=8) => s.toString().padEnd(w)

let head, body, main, label;
let start = performance.now(), elapsed = 0, count = 0, rate;

render_begin = (doc) => {
  head = Sky.$(doc.head)
  head.child('style').addRules({
    'html, body': {
      'width': '100%',
      'height': '100%',
      'margin': '0',
      'padding': '0'
    }
  })

  body = Sky.$(doc.body)
  main = body.child('main')

  label = main.div()
}

render_event = (event, doc, opts) => {
  count++;
  elapsed = (performance.now() - start) / 1000;
  rate = count / elapsed;
  label.txt(`${count} in ${elapsed.toFixed(2)}s = ${~~rate} / sec`)
}
