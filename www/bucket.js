const vzi = require('../lib/vzi')
const Sky = require('sky')
const Sun = require('sky/sun')
const Orb = require('sky/ext/orb')
const U = Sky.util, dfn = U.dfn;
const {
  k: kp,
  v: vp,
  c: cp,
  scale,
  alpha = .8,
  period = 1000,
  orderBy
} = Conf.define;

let key = vzi.indexOrEvalFun(kp, () => ~~((new Date - 0) / period), false)
let val = vzi.indexOrEvalFun(vp, () => 1)
let cVal = (parts, i) => parts[cp] || '-'
let xPerY = ((s) => s ? (x, y) => s(x) / s(y) : (x, y) => x / y)(vzi.maybeEvalFun(scale))

let SF, setDefaultSort = (defaultOrderBy = 'key') => {
  switch (orderBy || defaultOrderBy) {
  case 'freq':
  case 'val':
  case 'v':
    return SF = {
      roundIndex: Math.ceil,
      lessThan: (l, h) => l > h,
      comesBefore: ({v}, {v: v_}) => v < v_,
      siblingAfter: (n) => n.previousSibling,
      insertBefore: (a, b) => b.parentNode.insertBefore(a, b.nextSibling)
    }
  case 'name':
  case 'key':
  case 'k':
  default:
    return SF = {
      roundIndex: Math.floor,
      lessThan: (l, h) => l < h,
      comesBefore: ({k, c}, {k: k_, c: c_}) => [k, c] < [k_, c_],
      siblingAfter: (n) => n.nextSibling,
      insertBefore: (a, b) => b.parentNode.insertBefore(a, b)
    }
  }
}
setDefaultSort(orderBy)

let head, style, body, main, labels, buckets;
let colorLabels, kvLabels;
let bucketMap = {}, bucketTransform, colorMap = new vzi.ColorMap(alpha)
let oldMaxVal, newMaxVal, maxBucket;

function insertionPoint(nodes, point) {
  let L = 0, H = nodes.length;
  while (SF.lessThan(L, H)) {
    let i = SF.roundIndex((L + H) / 2)
    if (SF.comesBefore(dataPoint(nodes[i]), point))
      L = i + 1;
    else
      H = i;
  }
  return H;
}

function newBucket(point) {
  let i = insertionPoint(buckets.node.childNodes, point), {k, v, c} = point;
  return buckets.div({
    class: 'bucket',
    'data-k': k,
    'data-v': 0,
    'data-c': c
  }).style({
    'background-color': colorMap.colorIn(c, colorLabels)
  }).order(i)
}

function addToBucket(bucket, {k, v, c}) {
  let dp = dataPoint(bucket.node)
  let v_ = dp.v + v;
  let b_ = bucket.attrs({'data-v': v_})
  for (let bn = b_.node, bs; (bs = SF.siblingAfter(bn)) && !SF.comesBefore(dp, dataPoint(bs)); )
    SF.insertBefore(bs, bn)
  if (v_ > newMaxVal) {
    // one way or another, this is the new max
    newMaxVal = v_;
    if (maxBucket != bucket) {
      // if the max bucket changes, update the old max
      oldMaxVal = newMaxVal;
      maxBucket = bucket;
      // set all the other buckets as % of the old max
      for (let b of Object.values(bucketMap))
        if (b != bucket)
          b.style({height: 100 * xPerY(dataPoint(b.node).v, oldMaxVal) + '%'})
      // the max itself has constant height
      bucket.style({height: '85vh'})
    }
    // save the maxes
    main.attrs({
      'data-new-max-val': newMaxVal,
      'data-old-max-val': oldMaxVal
    })
    // whenever we update max: shrink the old max as % of new max
    return buckets.style({height: 80 * xPerY(oldMaxVal, newMaxVal) + 'vh'}), bucket;
  }
  // not max: just set height as % of old max
  return bucket.style({height: 100 * xPerY(v_, oldMaxVal) + '%'})
}

function dataPoint(node) {
  return {
    k: node.getAttribute('data-k'),
    v: parseFloat(node.getAttribute('data-v')) || 0,
    c: node.getAttribute('data-c')
  }
}

render_begin = (doc) => {
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

      '#colors, #kvs': {
        'position': 'fixed',
        'padding': '1ex 3ex',
        'min-height': '2em',
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

      '#buckets': {
        'display': 'flex',
        'justify-content': 'space-around',
        'align-items': 'flex-end',
        'overflow-y': 'visible'
      },
      '#buckets .bucket': {
        'flex': '1 0 auto',
        'margin': '0 4px',
        'min-width': '20px',
        'transition': 'all 0.3s'
      },
      '#buckets .bucket:hover': {
        'opacity': 0.5,
        'transition': 'all 0.3s'
      }
    })
    return style;
  })

  body = Sky.$(doc.body)
  main = body.unique('main', (p) => p.child('main'))

  labels = main.unique('#labels', (p) => p.div({id: 'labels'}))
  buckets = main.unique('#buckets', (p) => p.div({id: 'graph'}).div({id: 'buckets'}))
  buckets.each('.bucket', (node) => {
    let dp = dataPoint(node), b = `${dp.k}, ${dp.c}`
    let bucket = bucketMap[b] = Sky.$(node)
    if (!maxBucket)
      maxBucket = bucket;
    else if (SF.comesBefore(dataPoint(maxBucket.node), dp))
      maxBucket = bucket;
  })

  let domv = main.attr('data-old-max-val'),
      dnmv = main.attr('data-new-max-val')
  let init = !(domv || dnmv)

  oldMaxVal = domv || 1;
  newMaxVal = dnmv || 1;

  colorLabels = labels.unique('#colors', (p) => p.div({id: 'colors'}))
  colorLabels.colorLabelData(colorMap, alpha)
  init && colorLabels.swipe(colorLabels.wagon())

  kvLabels = labels.unique('#kvs', (p) => p.div({id: 'kvs'}))

  let kLabel = kvLabels.unique('#kLabel', (p) => p.div({id: 'kLabel', class: 'label'}))
  let vLabel = kvLabels.unique('#vLabel', (p) => p.div({id: 'vLabel', class: 'label'}))
  let update = (e) => {
    let {k, v, c} = dataPoint(e.target)
    if (e.type == 'mouseout' || (!k && !v)) {
      kLabel.txt(`# buckets: ${buckets.node.children.length}`)
      vLabel.txt(`max value: ${newMaxVal}`)
      kvLabels.style({top: '', left: '', right: ''})
      c && colorLabels.$(`.color[data-name="${c}"] .label`)
        .style({'background-color': 'initial'})
    } else {
      kLabel.txt(`k = ${k}`)
      vLabel.txt(`v = ${v}`)
      kvLabels.style({right: 'auto'}).xy(
        e.pageX + (e.pageX > body.bbox().midX ? -(kvLabels.bbox().w + 20) : 20),
        e.pageY - kvLabels.bbox().h / 2
      )
      c && colorLabels.$(`.color[data-name="${c}"] .label`)
        .style({'background-color': 'rgba(0, 0, 0, .1)'})
    }
  }
  init && buckets.on('mouseover', Sun.throttle(update, 5))
  init && buckets.on('mouseout', Sun.throttle(update, 5))
}

render_event = (event, doc, i) => {
  let parts = event.split(/\s+/)
  let k = key(parts, i),
      v = val(parts, i),
      c = cVal(parts, i)

  let b = `${k}, ${c}`
  if (!(b in bucketMap))
    bucketMap[b] = newBucket({k, v, c})
  addToBucket(bucketMap[b], {k, v, c})
}

module.exports = {
  setDefaultSort,
  render_begin,
  render_event
}