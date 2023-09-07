// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// @ts-nocheck
import { Sky } from '../vzi.ts';

let head, body, main, label;
let start = performance.now(), elapsed = 0, rate;

window.render_begin = (doc) => {
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

window.render_event = (event, doc, i) => {
  elapsed = (performance.now() - start) / 1000;
  rate = i / elapsed;
  label.txt(`${i} in ${elapsed.toFixed(2)}s = ${~~rate} / sec`)
}
