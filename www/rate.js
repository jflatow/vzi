const Sky = require('sky')

let head, body, main, label;
let start = performance.now(), elapsed = 0, rate;

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

render_event = (event, doc, i) => {
  elapsed = (performance.now() - start) / 1000;
  rate = i / elapsed;
  label.txt(`${i} in ${elapsed.toFixed(2)}s = ${~~rate} / sec`)
}
