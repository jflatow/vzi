// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// @ts-nocheck
import * as vzi from '../vzi.ts';

const { Sky, Sun, Components, Gestures } = vzi.SDK;
const { Wagon } = Components;
const { dfn } = Sky;
const {
  k: kp,
  v: vp,
  c: cp,
  alpha = .8,
  period = 5000,
  scale = null,
  stat = null,
  orderBy = null,
} = (window as any).Conf.define;

const key = vzi.indexOrEvalFun(kp, () => new Date(Math.floor((Date.now() - 0) / period) * period));
const val = vzi.indexOrEvalFun(vp, () => 1);
const col = vzi.indexOrEvalFun(cp, ($, i) => key($, i) ?? '-');
const xPerY = ((scale) => {
  if (scale)
    return (x, y) => scale(x) / scale(y);
  return (x, y) => x / y;
})(vzi.maybeEvalFun(scale));
const bucketName = ({ k, c }) => `${k}, ${c}`;

let VF;
export function setDefaultStat(defaultStat = 'sum') {
  switch (stat || defaultStat) {
    case 'avg':
    case 'mean':
      return VF = {
        add: ([c, n], dv) => [dfn(c + dv, c), n + 1],
        val: ([c, n]) => c / n,
        parse: (s) => s ? JSON.parse(`[${s}]`) : [0, 0],
      };
    case 'sum':
    default:
      return VF = {
        add: (v, dv) => v + dv,
        val: (v) => v,
        parse: (s) => parseFloat(s || 0),
      };
  }
}
setDefaultStat(stat ?? undefined);

let SF;
export function setDefaultSort(defaultOrderBy = 'key') {
  // NB: careful not to use equality checks when handling Dates!
  switch (orderBy || defaultOrderBy) {
    case 'freq':
    case 'value':
    case 'val':
    case 'v':
      return SF = {
        roundIndex: Math.ceil,
        lessThan: (l, h) => l > h,
        comesBefore: ({ v }, { v: v_ }) => v < v_,
        siblingAfter: (n) => n.previousSibling,
        insertBefore: (a, b) => b.parentNode.insertBefore(a, b.nextSibling),
      };
    case 'color':
    case 'colorKey':
    case 'ck':
    case 'c':
      return SF = {
        roundIndex: Math.floor,
        lessThan: (l, h) => l < h,
        comesBefore: ({ k, c }, { k: k_, c: c_ }) => c < c_ || (!(c > c_) && k < k_),
        siblingAfter: (n) => n.nextSibling,
        insertBefore: (a, b) => b.parentNode.insertBefore(a, b),
      };
    case 'name':
    case 'key':
    case 'keyColor':
    case 'kc':
    case 'k':
    default:
      return SF = {
        roundIndex: Math.floor,
        lessThan: (l, h) => l < h,
        comesBefore: ({ k, c }, { k: k_, c: c_ }) => k < k_ || (!(k > k_) && c < c_),
        siblingAfter: (n) => n.nextSibling,
        insertBefore: (a, b) => b.parentNode.insertBefore(a, b),
      };
  }
}
setDefaultSort(orderBy ?? undefined);

let head, style, body, main, labels, buckets;
let colorLabels, kvLabels;
let bucketMap = {}, bucketTransform, colorMap = new vzi.ColorMap(alpha);
let oldMaxVal, newMaxVal, maxBucket;

function insertionPoint(nodes, point) {
  let L = 0, H = nodes.length;
  while (SF.lessThan(L, H)) {
    const i = SF.roundIndex((L + H) / 2);
    if (SF.comesBefore(dataPoint(nodes[i]), point))
      L = i + 1;
    else
      H = i;
  }
  return H;
}

function newBucket(point) {
  const i = insertionPoint(buckets.node.childNodes, point), { k, v, c } = point;
  return buckets.div({
    class: 'bucket',
    'data-k': k,
    'data-c': c,
  }).style({
    'background-color': colorMap.colorIn(c, colorLabels),
  }).order(i);
}

function addToBucket(bucket, {k, v, c}) {
  const bn = bucket.node;
  const v_ = VF.add(dataPoint(bn).v, v);
  const b_ = bucket.attrs({ 'data-v': v_ });
  const dp = dataPoint(bn);
  const val = VF.val(v_);
  for (let bs; (bs = SF.siblingAfter(bn)) && !SF.comesBefore(dp, dataPoint(bs)); )
    SF.insertBefore(bs, bn);
  if (val > newMaxVal) {
    // one way or another, this is the new max
    newMaxVal = val;
    if (maxBucket != bucket || newMaxVal / oldMaxVal > 4) {
      // if the max bucket changes, update the old max
      oldMaxVal = newMaxVal;
      maxBucket = bucket;
      // set all the other buckets as % of the old max
      for (let b of Object.values(bucketMap))
        if (b != bucket)
          b.style({ height: 100 * xPerY(VF.val(dataPoint(b.node).v), oldMaxVal) + '%' });
      // the max itself has constant height
      bucket.style({ height: '85vh' });
    }
    // save the maxes
    main.attrs({
      'data-new-max-val': newMaxVal,
      'data-old-max-val': oldMaxVal
    });
    // whenever we update max: shrink the old max as % of new max
    return buckets.style({ height: 80 * xPerY(oldMaxVal, newMaxVal) + 'vh' }), bucket;
  }
  // not max: just set height as % of old max
  return bucket.style({ height: 100 * xPerY(val, oldMaxVal) + '%' });
}

function dataPoint(node) {
  return {
    k: vzi.tryNum(node.getAttribute('data-k')),
    v: VF.parse(node.getAttribute('data-v')),
    c: vzi.tryNum(node.getAttribute('data-c')),
  }
}

export function render_begin(doc, i) {
  head = Sky.$(doc.head);
  style = head.unique('style', (head) => {
    const style = head.child('style');
    style.addRules({
      '*': {
        'box-sizing': 'border-box'
      },

      '#labels .label': {
        'margin': '2px 1ex',
        'font-family': 'monospace',
        'font-size': 'small'
      },

      '#colors, #kvs': {
        'position': 'fixed',
        'padding': '1ex 3ex',
        'min-height': '2em',
        'max-height': '80vh',
        'white-space': 'nowrap',
        'background-color': 'rgba(255, 255, 255, .85)',
        'border': '1px solid #efefef',
        'border-radius': '4px',
        'z-index': 100
      },

      '#colors': {
        'top': '1ex',
        'left': '1ex',
        'overflow-y': 'scroll'
      },

      '#kvs': {
        'top': '1ex',
        'right': '1ex'
      },

      '#graph': {
        'position': 'fixed',
        'top': '2em',
        'left': '2em',
        'right': '2em',
        'bottom': '4em',
        'display': 'flex',
        'align-items': 'flex-end',
        'overflow-x': 'scroll'
      },

      '#graph::-webkit-scrollbar': {
        'height': 0
      },

      '#buckets': {
        'height': '80vh',
        'min-height': '2px',
        'display': 'flex',
        'justify-content': 'space-around',
        'align-items': 'flex-end',
        'overflow-y': 'visible'
      },
      '#buckets.locked:hover': {
        'cursor': 'no-drop'
      },
      '#buckets .bucket': {
        'flex': '1 0 auto',
        'margin': '0 4px',
        'min-width': '16px',
        'transition': 'all 0.3s'
      },
      '#buckets .bucket:hover': {
        'opacity': 0.5,
        'transition': 'all 0.3s'
      }
    });
    return style;
  });

  body = Sky.$(doc.body);
  main = body.unique('main', (p) => p.child('main'));

  labels = main.unique('#labels', (p) => p.div({ id: 'labels' }));
  buckets = main.unique('#buckets', (p) => p.div({ id: 'graph' }).div({ id: 'buckets' }));
  buckets.each('.bucket', (node) => {
    const dp = dataPoint(node), b = bucketName(dp);
    const bucket = bucketMap[b] = Sky.$(node);
    if (!maxBucket)
      maxBucket = bucket;
    else if (SF.comesBefore(dataPoint(maxBucket.node), dp))
      maxBucket = bucket;
  });

  const domv = main.attr('data-old-max-val');
  const dnmv = main.attr('data-new-max-val');

  oldMaxVal = domv || 1;
  newMaxVal = dnmv || 1;

  colorLabels = labels.unique('#colors', (p) => p.div({ id: 'colors' }));
  colorLabels.colorLabelData(colorMap, alpha);
  !i && Gestures.swipe(colorLabels, new Wagon(colorLabels));

  kvLabels = labels.unique('#kvs', (p) => p.div({ id: 'kvs' }));

  const kLabel = kvLabels.unique('#kLabel', (p) => p.div({ id: 'kLabel', class: 'label' }));
  const vLabel = kvLabels.unique('#vLabel', (p) => p.div({ id: 'vLabel', class: 'label' }));
  const cLabel = kvLabels.unique('#cLabel', (p) => p.div({ id: 'cLabel', class: 'label' }));
  const locked = false;
  const update = (e) => {
    const { k, v, c } = dataPoint(e.target);
    if (e.type == 'mouseout' || !(k || v)) {
      kLabel.txt(`# buckets: ${buckets.node.children.length}`);
      vLabel.txt(`max value: ${newMaxVal}`);
      cLabel.txt(`occurs in: ${maxBucket && dataPoint(maxBucket.node).k}`);
      c && colorLabels.$(`.color[data-name="${btoa(c)}"] .label`)
        .style({ 'background-color': 'initial' });
      if (!locked) {
        kvLabels.style({ top: '', left: '', right: '' });
      }
    } else {
      kLabel.txt(`k = ${k}`);
      vLabel.txt(`v = ${VF.val(v)}`);
      cLabel.txt(c == '-' ? '' : `c = ${c}`);
      c && colorLabels.$(`.color[data-name="${btoa(c)}"] .label`)
        .style({ 'background-color': 'rgba(0, 0, 0, .1)' });
      if (!locked) {
        kvLabels.style({ right: 'auto' }).xy(
          e.pageX + (e.pageX > body.bbox().midX ? -(kvLabels.bbox().w + 16) : 16),
          e.pageY - kvLabels.bbox().h / 2,
        );
      }
    }
    kvLabels.style({border: locked ? '1px solid #aaa' : ''});
  }
  !i && buckets.on('mouseover', Sun.throttle(update, 5));
  !i && buckets.on('mouseout', Sun.throttle(update, 5));
  !i && buckets.on('click', (e) => {
    buckets.toggleClass('locked', locked = !locked);
    update(e);
  });
}

export function render_event(event, doc, i) {
  const k = key(event, i);
  const v = val(event, i);
  const c = col(event, i);
  const dp = { k, v, c };
  const b = bucketName(dp);
  if (!(b in bucketMap))
    bucketMap[b] = newBucket(dp);
  addToBucket(bucketMap[b], dp);
}

// can be used as a module itself:
window.render_begin = render_begin;
window.render_event = render_event;
