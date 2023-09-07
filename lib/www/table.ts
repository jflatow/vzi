// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// @ts-nocheck
import * as vzi from '../vzi.ts';

const { Sky } = vzi;
const {
  col,
  header
} = Conf.define;

const cmp = (a, b) => a == b ? 0 : (a < b ? -1 : 1);
const formulate = (s) => ($) => window.eval(s);

let head, style, body, main, table, thead, tbody;
let cols, defs, data;

window.render_begin = (doc, init, seed) => {
  head = Sky.$(doc.head)
  style = head.unique('style', (head) => {
    let style = head.child('style').addRules({
      'html, body': {
        'width': '100%',
        'height': '100%',
        'margin': '0',
        'padding': '0'
      },

      'thead td': {
        'cursor': 'pointer',
        'background-color': '#fafaff',
        'transition': 'all 0.3s'
      },

      'td': {
        'padding': '1ex 1em',
        'transition': 'all 0.3s'
      },

      'td:hover': {
        'background-color': '#f9f9f9',
        'transition': 'all 0.3s'
      },
    });
  });

  if (seed)
    doc.body.outerHTML = seed;

  body = Sky.$(doc.body);
  main = body.unique('main', (p) => p.child('main'));
  table = main.unique('table', (p) => p.child('table'));
  thead = table.unique('thead', (p) => p.child('thead'));
  tbody = table.unique('tbody', (p) => p.child('tbody'));

  defs = col || [];
  if (!(col instanceof Array))
    defs = col ? [col] : [];
  cols = defs.map(formulate);

  data = tbody.each('tr', (node, acc) => {
    return acc.push(Array.prototype.map.call(node.childNodes, (d) => d.innerText)), acc;
  }, []);

  const click = (e) => {
    let tc = e.target;
    let f = formulate(tc.getAttribute('data-formula'));
    let g = (x) => vzi.tryNum(f(x));
    let D = !tc.getAttribute('data-ascending');
    if (D) {
      data.sort((a, b) => cmp(g(a), g(b)));
      tc.setAttribute('data-ascending', true);
    } else {
      data.sort((a, b) => cmp(g(b), g(a)));
      tc.removeAttribute('data-ascending');
    }
    data.map((ev, i) => {
      let j = 0, tr = tbody.node.childNodes[i];
      for (let f of ev)
        tr.childNodes[j++].innerText = f;
    });
  };
  thead.on('click', click);
}

window.render_event = (event, doc, i) => {
  if (header && i == 0) {
    const row = thead.child('tr');
    for (const f of event)
      row.child('td').txt(f).attrs({
        'data-formula': `\$[${i++}]`
      });
    for (const c of defs)
      row.child('td').txt(c.replace(/\$\[(\d+)\]/g, (_, k) => event[k])).attrs({
        'data-formula': c
      });
  } else {
    const row = tbody.child('tr');
    for (const c of cols)
      event.push(c(event));
    for (const f of event)
      row.child('td').txt(f);
    data.push(event);
  }
}
