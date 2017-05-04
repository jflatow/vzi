const vzi = require('../lib/vzi')
const Sky = require('sky')
const Sun = require('sky/sun')
const U = Sky.util, dfn = U.dfn;
const {
  k: kp,
  v: vp,
  c: cp,
  alpha = .8,
  period = 1000
} = Conf.define;

let key = vzi.indexOrEvalFun(kp, () => ~~((new Date - 0) / period), false)
let val = vzi.indexOrEvalFun(vp, () => 1)
let cVal = (parts, i) => parts[cp] || '-'

let head, body, main, labels, buckets;
let colorLabels, kvLabels;
let bbox, vbox;
let bucketMap = {}, colorMap = new vzi.ColorMap()

function color(c) {
  return colorMap.obtain(c, alpha, (rgb) => {
    let div = colorLabels.row(['1em', '1ex', 'fit'])
    div.nth(0).style({width: '1em', height: '1em', backgroundColor: new Sky.RGB(rgb).update({a: 1})})
    div.nth(2).attrs({class: 'label'}).txt(c)
  })
}


function newBucket(k, c) {
  let p = buckets.node, ns = p.childNodes, L = 0, H = ns.length;
  while (L < H) {
    let i = ~~((L + H) / 2)
    if (ns[i].getAttribute('data-k') < k)
      L = i + 1;
    else
      H = i;
  }
  return buckets.div({class: 'bucket', 'data-k': k, 'data-v': 0})
    .style({'background-color': color(c)})
    .order(H)
}

function addToBucket(bucket, v) {
  let v_ = parseFloat(bucket.attr('data-v') || 0) + v;
  vbox = vbox.join(Sky.box(0, Math.min(v, 0), 0, v_))
  let h_ = bbox.h * (v_ / vbox.h);
  return bucket.attrs({'data-v': v_}).wh('auto', h_)
}

render_begin = (doc) => {
  head = Sky.$(doc.head)
  head.unique('style', (head) => {
    return head.child('style').addRules({
      '*': {
        'box-sizing': 'border-box'
      },
      'html, body, main': {
        'width': '100%',
        'height': '100%'
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

      '#buckets': {
        'display': 'flex',
        'justify-content': 'space-around',
        'align-items': 'flex-end'
      },

      '#buckets .bucket': {
        'flex': '1 0 auto',
        'margin': '0 4px',
        'min-width': '6px'
      }
    })
  })

  body = Sky.$(doc.body)
  main = body.unique('main', (p) => p.child('main'))

  labels = main.unique('#labels', (p) => p.row(['fit', '4px', 'fit']).attrs({id: 'labels'}))
  buckets = main.unique('#buckets', (p) => p.div({id: 'buckets'}))

  colorLabels = labels.unique('#colors', (p) => p.nth(0).attrs({id: 'colors'}))
  kvLabels = labels.unique('#kvs', (p) => p.nth(2).attrs({id: 'kvs'}))

  let kLabel = kvLabels.unique('#kLabel', (p) => p.div({id: 'kLabel', class: 'label'}))
  let vLabel = kvLabels.unique('#vLabel', (p) => p.div({id: 'vLabel', class: 'label'}))
  let update = (e) => {
    let k = e.target.getAttribute('data-k'),
        v = e.target.getAttribute('data-v')
    k && kLabel.txt(`k = ${e.target.getAttribute('data-k')}`)
    v && vLabel.txt(`v = ${e.target.getAttribute('data-v')}`)
  }
  buckets.on('mouseenter', update)
  buckets.on('mouseover', Sun.throttle(update, 1))

  bbox = main.bbox()
  vbox = Sky.box()
}

render_event = (event, doc, i) => {
  let parts = event.split(/\s+/)
  let k = key(parts, i),
      v = val(parts, i),
      c = cVal(parts, i)

  let b = [k, c]
  if (!(b in bucketMap))
    bucketMap[b] = newBucket(k, c)
  addToBucket(bucketMap[b], v)
}