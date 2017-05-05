const vzi = require('../lib/vzi')
const Sky = require('sky')
const Sun = require('sky/sun')
const U = Sky.util, dfn = U.dfn;
const {
  k: kp,
  v: vp,
  c: cp,
  alpha = .8,
  period = 1000,
  orderBy = 'key'
} = Conf.define;

let key = vzi.indexOrEvalFun(kp, () => ~~((new Date - 0) / period), false)
let val = vzi.indexOrEvalFun(vp, () => 1)
let cVal = (parts, i) => parts[cp] || '-'
let lessThan = (function comparator() {
  switch (orderBy) {
  case 'val':
    return ({v}, {v: v_}) => v < v_;
  case 'key':
  default:
    return ({k}, {k: k_}) => k < k_;
  }
})()

let head, style, body, main, labels, buckets;
let colorLabels, kvLabels;
let bucketMap = {}, bucketTransform, colorMap = new vzi.ColorMap()
let oldMaxVal = 1, newMaxVal = 1, maxBucket;

function color(c) {
  return colorMap.obtain(c, alpha, (rgb) => {
    let div = colorLabels.row(['1em', '1ex', 'fit'])
    div.nth(0).style({width: '1em', height: '1em', backgroundColor: new Sky.RGB(rgb).update({a: 1})})
    div.nth(2).attrs({class: 'label'}).txt(c)
  })
}

function insertionPoint(nodes, point) {
  let L = 0, H = nodes.length;
  while (L < H) {
    let i = ~~((L + H) / 2)
    if (lessThan(dataPoint(nodes[i]), point))
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
  }).style({'background-color': color(c)}).order(i)
}

function addToBucket(bucket, {k, v, c}) {
  let dp = dataPoint(bucket.node)
  let v_ = dp.v + v;
  let b_ = bucket.attrs({'data-v': v_})
  for (let bn = b_.node, bs; (bs = bn.nextSibling) && !lessThan(dp, dataPoint(bs)); )
    bn.parentNode.insertBefore(bs, bn)
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
          b.style({height: 100 * (dataPoint(b.node).v / oldMaxVal) + '%'})
      // the max itself has constant height
      bucket.style({height: '80vh'})
    }
    // whenever we update max: shrink the old max as % of new max
    return buckets.style({height: 80 * (oldMaxVal / newMaxVal) + 'vh'}), bucket;
  }
  // not max: just set height as % of old max
  return bucket.style({height: 100 * (v_ / oldMaxVal) + '%'})
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

      '#labels': {
        'position': 'fixed',
        'top': '4px',
        'left': '8px',
        'align-items': 'flex-start'
      },
      '#labels .label': {
        'flex': '1 0 auto',
        'margin': '2px 1ex',
        'font-family': 'monospace',
        'font-size': 'small'
      },

      '#colors, #kvs': {
        'padding': '1ex 3ex',
        'min-height': '2em',
        'background-color': 'rgba(255, 255, 255, .8)',
        'border': '1px solid #efefef',
        'border-radius': '4px'
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
        'min-width': '8px'
      }
    })
    return style;
  })

  body = Sky.$(doc.body)
  main = body.unique('main', (p) => p.child('main'))

  labels = main.unique('#labels', (p) => p.row(['fit', '4px', 'fit']).attrs({id: 'labels'}))
  buckets = main.unique('#buckets', (p) => p.div({id: 'graph'}).div({id: 'buckets'}))

  colorLabels = labels.unique('#colors', (p) => p.nth(0).attrs({id: 'colors'}))
  kvLabels = labels.unique('#kvs', (p) => p.nth(2).attrs({id: 'kvs'}))

  let kLabel = kvLabels.unique('#kLabel', (p) => p.div({id: 'kLabel', class: 'label'}))
  let vLabel = kvLabels.unique('#vLabel', (p) => p.div({id: 'vLabel', class: 'label'}))
  let update = (e) => {
    let k = e.target.getAttribute('data-k'),
        v = e.target.getAttribute('data-v')
    kLabel.txt(k ? `k = ${e.target.getAttribute('data-k')}` : '')
    vLabel.txt(v ? `v = ${e.target.getAttribute('data-v')}` : '')
  }
  buckets.on('mouseenter', update)
  buckets.on('mouseover', Sun.throttle(update, 1))
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