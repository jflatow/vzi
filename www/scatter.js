const vzi = require('../lib/vzi')
const Sky = require('sky')
const Sun = require('sky/sun')
const U = Sky.util, dfn = U.dfn, clip = U.clip;
const tau = 2 * Math.PI;
const {
  x: xp,
  y: yp,
  r: rp,
  c: cp,
  xs,
  ys,
  alpha = .1,
  xMin = -Infinity,
  xMax = +Infinity,
  yMin = -Infinity,
  yMax = +Infinity
} = Conf.define;

let xVal = vzi.indexOrEvalFun(xp, (parts, i) => dfn(parseFloat(parts[1]), i))
let yVal = vzi.indexOrEvalFun(yp, (parts, i) => dfn(parseFloat(parts[0]), 0))
let rVal = vzi.indexOrEvalFun(rp, (parts, i) => 8)
let cVal = (parts, i) => parts[cp] || parts[2] || '-'
let xStr = vzi.maybeEvalFun(xs, (x) => x.toFixed(2))
let yStr = vzi.maybeEvalFun(ys, (y) => y.toFixed(2))

let head, body, main, labels, canvas, ctx, fctx;
let colorLabels, xyLabels;
let bbox, cbox, pbox, vbox;
let colors = [], cmap = {}

function color(c) {
  if (!(c in cmap)) {
    let rgb = Sky.rgb(...['r', 'g', 'b'].map(() => U.randInt(0, 255)), alpha)
    cmap[c] = colors.push(rgb) - 1;

    let div = colorLabels.row(['1em', '1ex', 'fit'])
    div.nth(0).style({width: '1em', height: '1em', backgroundColor: new Sky.RGB(rgb).update({a: 1})})
    div.nth(2).attrs({class: 'label'}).txt(c)
  }
  return colors[cmap[c]]
}

function dot({x, y, c, r}) {
  let {x: cx, y: cy} = dataToCanvas({x, y})
  ctx.fillStyle = color(c)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, tau)
  ctx.fill()
}

function resize(box = Sky.box()) {
  // copy the canvas to another one and then copy it back after resize, to keep a low-fi history
  let real = canvas.node, fake = fctx.canvas;
  let w = real.width, h = real.height, aspect = w / h;
  let w_ = real.clientWidth, h_ = real.clientHeight;
  if (w_ / aspect > h_)
    h_ = (w_ / aspect)
  else
    w_ = (h_ * aspect)
  let a = canvasToData({x: 0, y: 0}), b = canvasToData({x: w, y: h})

  fctx.drawImage(real, 0, 0)
  bbox = Sky.box(0, 0, w_, h_)
  cbox = Sky.box(0, 0, real.width = w_, real.height = h_)
  pbox = cbox.trim(30, 24)
  vbox = vbox.join(box)
  ctx.setTransform(1, 0, 0, -1, 0, cbox.h)

  let {x: ux, y: uy} = dataToCanvas(a)
  let {x: uw, y: uh} = dataToCanvas(b)

  ctx.drawImage(fake, ux, uy, uw, uh)
  fake.width = w_;
  fake.height = h_;
  fctx.setTransform(1, 0, 0, -1, 0, cbox.h)
}

function dataToCanvas({x, y}) {
  return {
    x: pbox.x + pbox.w * (x - vbox.x) / vbox.w,
    y: pbox.y + pbox.h * (y - vbox.y) / vbox.h
  }
}

function canvasToData({x, y}) {
  return {
    x: vbox.x + vbox.w * (x - pbox.x) / pbox.w,
    y: vbox.y + vbox.h * (y - pbox.y) / pbox.h
  }
}

function dataToView({x, y}) {
  return {
    x: vbox.x + vbox.w * (x - pbox.x) / pbox.w,
    y: vbox.y + vbox.h * (cbox.h - y - pbox.y) / pbox.h
  }
}

render_begin = (doc) => {
  head = Sky.$(doc.head)
  head.unique('style', (head) => {
    return head.child('style').addRules({
      '*': {
        'box-sizing': 'border-box'
      },
      'html, body, canvas': {
        'width': '100%',
        'height': '100%',
        'margin': '0',
        'padding': '0'
      },

      '#labels': {
        'position': 'fixed',
        'top': '4px',
        'left': '8px',
        'align-items': 'flex-start'
      },
      '#labels .label': {
        'margin': '2px 1ex',
        'font-family': 'monospace',
        'font-size': 'small'
      },

      '#colors, #xys': {
        'padding': '1ex 3ex',
        'min-height': '1em',
        'background-color': 'rgba(255, 255, 255, .8)',
        'border': '1px solid #efefef',
        'border-radius': '4px'
      }
    })
  })

  body = Sky.$(doc.body)
  main = body.unique('main', (p) => p.child('main'))

  labels = main.unique('#labels', (p) => p.row(['fit', '4px', 'fit']).attrs({id: 'labels'}))
  canvas = main.unique('#canvas', (p) => p.child('canvas', {id: 'canvas'}))

  bbox = canvas.bbox()
  cbox = canvas.bbox()
  pbox = cbox.trim(30, 24)
  vbox = Sky.box()
  ctx = canvas.node.getContext('2d')
  fctx = doc.createElement('canvas').getContext('2d')
  resize()

  colorLabels = labels.unique('#colors', (p) => p.nth(0).attrs({id: 'colors'}))
  xyLabels = labels.unique('#xys', (p) => p.nth(2).attrs({id: 'xys'}))

  let xLabel = xyLabels.unique('#xLabel', (p) => p.div({id: 'xLabel', class: 'label'}))
  let yLabel = xyLabels.unique('#yLabel', (p) => p.div({id: 'yLabel', class: 'label'}))
  let update = (e) => {
    let {x, y} = dataToView({
      x: e.pageX - e.target.offsetLeft,
      y: e.pageY - e.target.offsetTop
    })
    xLabel.txt(`x = ${xStr(x)}`)
    yLabel.txt(`y = ${yStr(y)}`)
  }
  canvas.on('mouseenter', update)
  canvas.on('mousemove', Sun.throttle(update, 1))
}

render_event = (event, doc, i) => {
  let parts = event.split(/\s+/)
  let x = clip(xVal(parts, i), xMin, xMax),
      y = clip(yVal(parts, i), yMin, yMax),
      r = rVal(parts, i),
      c = cVal(parts, i)

  if (!isFinite(x) || !isFinite(y)) {
    console.log(`${x}, ${y} not finite, skipping ${parts}`)
    return;
  }
  if (x < vbox.left || x > vbox.right || y < vbox.top || y > vbox.bottom) {
    console.log(`(${x}, ${y}) not in (${vbox})`)
    resize(Sky.box(Math.min(x, 0), Math.min(y, 0), x, y))
  }

  dot({x, y, c, r})
}
