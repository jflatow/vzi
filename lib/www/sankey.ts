// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// @ts-nocheck
import * as vzi from '../vzi.ts';

const { Sky, Sun } = vzi;
const { P, dfn, fnt, up } = Sky;
const { Uni } = Sun;
const {
  t: tp,
  range: rp,
  label: lp,
  alpha = 0.6,
  limit
} = Conf.define;

const Prefs = {
  time: vzi.indexOrEvalFun(tp, () => ~~((new Date - 0) / 1000), false),
  range: vzi.indexOrEvalFun(rp, (ev, i) => ev[0]),
  label: vzi.indexOrEvalFun(lp, null, false),
  limit: limit
}

let summarizer;
let head, style, body, main, labels, graph;
let grpLabels;

function diff(b, a) {
  if (typeof(b) == 'number' && typeof(a) == 'number')
    return b - a;
  if (a == undefined)
    return b ? +1 : 0;
  if (b == undefined)
    return a ? -1 : 0;
  let d = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    d += (dfn(b.charCodeAt(i), 0) - dfn(a.charCodeAt(i), 0)) / Math.pow(256, i)
  return d;
}

function tstamp(t) {
  if (typeof(t) == 'number')
    return vzi.second(t)
  return t;
}

class Summarizer {
  constructor(node, time = Prefs.time) {
    this.animate = Sun.throttle(() => window.requestAnimationFrame(() => this.draw()), 1)
    this.cache = {}
    this.colorMap = new vzi.ColorMap()
    this.elem = Sky.$(node)
    this.time = time;
  }

  draw() {
    let bounds = new Map(), j = 0;
    for (let [t, groups] of this.samples()) {
      let carry = 0;
      for (let [g, bs] of bounds) {
        // first go through the existing bounds (in order)
        // alloc or dealloc space as needed by new group
        let b = groups.get(g) || {size: 0}
        carry = dfn(b.offset, carry)
        bs.push(up(b, {top: carry, bottom: carry + b.size}))
        carry += b.size;
      }
      for (let [g, b] of groups) {
        // then for groups that still do not exist, initialize them
        // backfill bounds to 0 for as many as they missed
        if (!bounds.has(g)) {
          let bs = (new Array(j)).fill({top: 0, bottom: 0})
          carry = dfn(b.offset, carry)
          bs.push(up(b, {top: carry, bottom: carry + b.size}))
          bounds.set(g, bs)
          carry += b.size;
        }
      }
      j++;
    }

    let lines = this.elem.unique('#lines', (p) => p.g({id: 'lines'}))
    let marks = this.elem.unique('#marks', (p) => p.g({id: 'marks'}))

    let i = 0;
    for (let [g, bs] of bounds) {
      lines.unique(`path[name="line-${g}"]`, (p) => p.path().attrs({name: `line-${g}`}))
        .attrs({
          d: (P.M([0, 0]) +
              bs.reduce((a, b) => a + P.L([++i, b.top]), '') +
              bs.reduceRight((a, b) => a + P.L([i--, b.bottom]), '') + 'Z'),
          fill: this.colorMap.obtain(g).alpha(alpha)
        })
      bs.map((b, i) => {
        marks.unique(`rect[name="mark-${g}-${i}"`, (p) => p.rect().attrs({name: `mark-${g}-${i}`}))
          .xywh(i + .8, b.top, 0.4, b.bottom - b.top)
          .attrs({'data-value': JSON.stringify(b)})
          .style({cursor: 'pointer', opacity: 0})
      })
    }
    this.elem.fit().attrs({preserveAspectRatio: 'none'})
  }

  addEvent(event, i) {
    /* project the event into the summarizer's samples / groups */
  }

  *samples() {
    /* return for each time point, a map of group name to {size} */
  }
}

class LabelSummarizer extends Summarizer {
  constructor(node, time = Prefs.time, label = Prefs.label, limit = Prefs.limit) {
    super(node, time)
    this.label = label;
    this.limit = limit;
  }

  addEvent(event, i) {
    // project the event onto each label
    let t = this.time(event)
    let lbls = this.label(event, i)
    let group = this.cache[t] || {}
    if (typeof(lbls) == 'object')
      for (let l in lbls)
        group[l] = dfn(group[l], 0) + lbls[l]
    else
      group[lbls] = dfn(group[lbls], 0) + 1;
    this.cache[t] = group;
  }

  *samples() {
    for (let t of Object.keys(this.cache).sort())
      yield [t, new Map(vzi.topK(this.cache[t], this.limit).map(([name, size]) => {
        return [name, {time: t, size, count: size, desc: name}]
      }))]
  }
}

class RangeSummarizer extends Summarizer {
  constructor(node, time = Prefs.time, value = Prefs.range, limit = Prefs.limit) {
    super(node, time)
    this.value = value;
    this.limit = limit || 10;
    this.total = {}
  }

  addEvent(event, i) {
    // insert the event value in order
    let t = this.time(event)
    let v = this.value(event, i)
    let vs = this.cache[t] || []
    let lo = 0, hi = vs.length, mid, item;
    while (lo < hi) {
      let [v_, count] = vs[mid = ~~((lo + hi) / 2)] || []
      if (v_ < v) {
        lo = mid + 1;
      } else if (v_ > v) {
        hi = mid;
      } else {
        item = vs[mid] = [v, count + 1]
        break;
      }
    }
    if (!item)
      vs.splice(hi, 0, [v, 1])
    this.cache[t] = vs;
    this.total[t] = (this.total[t] || 0) + 1;
  }

  *samples() {
    // convert the sorted list into quantiles
    for (let t of Object.keys(this.cache).sort()) {
      let L = this.limit, per = this.total[t] / L;
      let vs = this.cache[t]
      if (vs.length <= L) {
        yield [t, new Map(vs.map(([v, count], i) => [i, {time: t, offset: fnt(v), size: 1, count, desc: `Value: ${v}`}]))]
      } else {
        let quantiles = [], cumsum = 0, Q, q;
        for (let i = 0; i < L; i++)
          quantiles.push({time: t, size: 0, count: 0})
        for (let [v, count] of vs) {
          cumsum += count;
          Q = ~~((cumsum - 1) / per)
          q = quantiles[Q]
          q.min = Uni.min(q.min, v)
          q.max = Uni.max(q.max, v)
          q.count += count;
        }
        yield [t, new Map(quantiles.map((q, i) => {
          return [i, up(q, {offset: fnt(q.min), size: diff(q.max, q.min), desc: `Range: ${q.min} - ${q.max}`})]
        }))]
      }
    }
  }
}

render_begin = (doc, i) => {
  head = Sky.$(doc.head)
  style = head.unique('style', (head) => {
    let style = head.child('style')
    style.addRules({
      '*': {
        'box-sizing': 'border-box'
      },

      '#labels .label': {
        'margin': '2px 1ex',
        'font-family': 'monospace',
        'font-size': 'small'
      },

      '#graph': {
        'margin-left': '1em'
      },

      '#grp': {
        'position': 'fixed',
        'top': '1ex',
        'right': '1ex',
        'padding': '1ex 3ex',
        'min-height': '2em',
        'max-height': '80vh',
        'white-space': 'nowrap',
        'background-color': 'rgba(255, 255, 255, .85)',
        'border': '1px solid #efefef',
        'border-radius': '4px',
        'z-index': 100
      },

      '#graph': {
        'width': '100vw',
        'height': '100vh'
      }
    })
    return style;
  })

  body = Sky.$(doc.body)
  main = body.unique('main', (p) => p.child('main'))

  labels = main.unique('#labels', (p) => p.div({id: 'labels'}))
  graph = main.unique('#graph', (p) => p.svg({id: 'graph'}))

  grpLabels = labels.unique('#grp', (p) => p.div({id: 'grp'}))

  let dLabel = grpLabels.unique('#dLabel', (p) => p.div({id: 'dLabel', class: 'label'}))
  let cLabel = grpLabels.unique('#cLabel', (p) => p.div({id: 'cLabel', class: 'label'}))
  let tLabel = grpLabels.unique('#tLabel', (p) => p.div({id: 'tLabel', class: 'label'}))
  let update = (e) => {
    let v = e.target.getAttribute('data-value')
    if (v) {
      if (e.type == 'mouseout') {
        e.target.style.opacity = 0;
        dLabel.txt('')
        cLabel.txt('')
        tLabel.txt('')
        grpLabels.style({top: '', left: '', right: ''})
      } else {
        let b = JSON.parse(v)
        e.target.style.opacity = .1;
        dLabel.txt(`${b.desc}`)
        cLabel.txt(`Count: ${b.count}`)
        tLabel.txt(`@ ${tstamp(b.time)}`)
        grpLabels.style({right: 'auto'}).xy(
          e.pageX + (e.pageX > body.bbox().midX ? -(grpLabels.bbox().w + 16) : 16),
          e.pageY + (e.pageY > body.bbox().midY ? -(grpLabels.bbox().h + 16) : 16)
        )
      }
    }
  }
  !i && graph.on('mouseover', Sun.throttle(update, 5))
  !i && graph.on('mouseout', Sun.throttle(update, 5))

  if (Prefs.label)
    summarizer = new LabelSummarizer(graph.node)
  else
    summarizer = new RangeSummarizer(graph.node)
}

render_event = (event, doc, i) => {
  // TODO: not yet re-streamable (does not bootstrap state from doc)
  summarizer.addEvent(event, i)
  summarizer.animate()
}