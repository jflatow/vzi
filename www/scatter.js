const vzi = require('../lib/vzi')
const Sky = require('sky')
const Sun = require('sky/sun')
const Orb = require('sky/ext/orb')
const U = Sky.util, {dfn, clip} = U;
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
let rVal = vzi.indexOrEvalFun(rp, (parts, i) => 4)
let cVal = (parts, i) => parts[cp] || parts[2] || '-'
let xStr = vzi.maybeEvalFun(xs, (x) => x.toFixed(2))
let yStr = vzi.maybeEvalFun(ys, (y) => y.toFixed(2))

let head, body, main, labels, canvas, ctx, fctx;
let colorLabels, xyLabels, originLabel, skipLabel;
let cbox, dbox, vbox, skips = 0;
let colorMap = new vzi.ColorMap()

function color(c) {
  return colorMap.obtain(c, alpha, (rgb) => {
    let div = colorLabels.row(['1em', '1ex', 'fit'])
    div.nth(0).style({width: '1em', height: '1em', backgroundColor: new Sky.RGB(rgb).update({a: 1})})
    div.nth(2).attrs({class: 'label'}).txt(c)
  })
}

function dot({x, y, c, r}) {
  let {x: cx, y: cy} = dataToCanvas({x, y})
  ctx.fillStyle = color(c)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, tau)
  ctx.fill()
}

Sky.Box.prototype.analog = function (d, s) {
  // this box, if it were in system d instead of s
  let a = this, b = Sky.box()
  b.w = a.w * d.w / s.w;
  b.h = a.h * d.h / s.h;
  b.x = (a.x - s.x) * d.w / s.w + d.x;
  b.y = (a.y - s.y) * d.h / s.h + d.y;
  return b;
}

Sky.Box.prototype.closure = function (like) {
  // smallest box that contains this one and is proportional to like
  if (like.w > like.h)
    return this.copy({h: this.w * like.w / like.h})
  return this.copy({w: this.h * like.h / like.w})
}

function resize(dbox = Sky.box()) {
  let real = canvas.node, fake = fctx.canvas;

  // copy the real canvas to the fake one temporarily
  fake.width = real.width,
  fake.height = real.height;
  fctx.setTransform(1, 0, 0, -1, 0, cbox.h)
  fctx.drawImage(real, 0, 0)

  // update the bounds for the canvas box that we will draw inside
  cbox = canvas.bbox()
  real.width = cbox.w;
  real.height = cbox.h;
  ctx.setTransform(1, 0, 0, -1, 0, cbox.h)

  // find vbox containing dbox + 10% that has desired aspect ratio
  let vbox_ = vbox.copy()
  vbox = dbox.pad(dbox.h / 10 || 1, dbox.w / 10 || 1).closure(cbox)
  console.log(`resizing view to ${vbox.w} x ${vbox.h}`)

  // if vbox_ were in cbox instead of vbox, where exactly would it be?
  let cbox_ = vbox_.analog(cbox, vbox)

  // copy the image back to exactly that spot
  ctx.drawImage(fake, cbox_.x, cbox_.y, cbox_.w, cbox_.h)

  // mark the origin
  let {x: ox, y: oy} = dataToViewport({x: 0, y: 0}), o = originLabel.node;
  originLabel.xy(ox, oy)
}

function dataToCanvas({x, y}) {
  return {
    x: cbox.x + cbox.w * (x - vbox.x) / vbox.w,
    y: cbox.y + cbox.h * (y - vbox.y) / vbox.h
  }
}

function canvasToData({x, y}) {
  return {
    x: vbox.x + vbox.w * (x - cbox.x) / cbox.w,
    y: vbox.y + vbox.h * (y - cbox.y) / cbox.h
  }
}

function dataToViewport({x, y}) {
  return {
    x: cbox.x + cbox.w * (x - vbox.x) / vbox.w,
    y: cbox.y + cbox.h * (vbox.h - y + vbox.y) / vbox.h
  }
}


function viewportToData({x, y}) {
  return {
    x: vbox.x + vbox.w * (x - cbox.x) / cbox.w,
    y: vbox.y + vbox.h * (cbox.h - y + cbox.y) / cbox.h
  }
}

render_begin = (doc) => {
  head = Sky.$(doc.head)
  head.unique('style', (head) => {
    return head.child('style').addRules({
      '*': {
        'box-sizing': 'border-box'
      },
      'html, body, main, canvas': {
        'width': '100%',
        'height': '100%',
        'margin': 0,
        'padding': 0
      },

      'main': {
        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'center'
      },

      '#labels .label': {
        'margin': '2px 1ex',
        'font-family': 'monospace',
        'font-size': 'small'
      },

      '#colors, #xys, #skips': {
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

      '#xys': {
        'top': '-10em',
        'left': '-10em'
      },

      '#skips': {
        'bottom': 0,
        'right': 0
      },

      '#origin': {
        'width': '10px',
        'height': '10px',
        'border': '1px solid rgba(0, 0, 0, .5)',
        'border-radius': '5px',
        'transform': 'translate(-5px, -5px)',
        'z-index': 50
      }
    })
  })

  body = Sky.$(doc.body)
  main = body.unique('main', (p) => p.child('main'))

  labels = main.unique('#labels', (p) => p.div({id: 'labels'}))
  canvas = main.unique('#canvas', (p) => p.child('canvas', {id: 'canvas'}))

  cbox = canvas.bbox()
  dbox = Sky.box()
  vbox = Sky.box(0, 0, 1, 1)
  ctx = canvas.node.getContext('2d')
  fctx = doc.createElement('canvas').getContext('2d')

  colorLabels = labels.unique('#colors', (p) => p.div({id: 'colors'}))
  colorLabels.swipe(colorLabels.wagon())

  xyLabels = labels.unique('#xys', (p) => p.div({id: 'xys'}))
  originLabel = labels.unique('#origin', (p) => p.div({id: 'origin'}))

  skipLabel = labels.unique('#skips', (p) => p.div({id: 'skips', class: 'label'}))
  skipLabel.swipe(skipLabel.wagon())

  let xLabel = xyLabels.unique('#xLabel', (p) => p.div({id: 'xLabel', class: 'label'}))
  let yLabel = xyLabels.unique('#yLabel', (p) => p.div({id: 'yLabel', class: 'label'}))
  let update = (e) => {
    let {x, y} = viewportToData({
      x: e.pageX - e.target.offsetLeft,
      y: e.pageY - e.target.offsetTop
    })
    xLabel.txt(`x = ${xStr(x)}`)
    yLabel.txt(`y = ${yStr(y)}`)
    xyLabels.xy(
      e.pageX + (e.pageX > cbox.midX ? -(xyLabels.bbox().w + 20) : 20),
      e.pageY - xyLabels.bbox().h / 2
    )
  }
  canvas.on('mouseenter', update)
  canvas.on('mousemove', Sun.throttle(update, 5))
  resize()
}

render_event = (event, doc, i) => {
  let parts = event.split(/\s+/)
  let x = clip(xVal(parts, i), xMin, xMax),
      y = clip(yVal(parts, i), yMin, yMax),
      r = rVal(parts, i),
      c = cVal(parts, i)

  if (!isFinite(x) || !isFinite(y))
    return skipLabel.txt(`${skips++} skipped`)

  if (x < vbox.left || x > vbox.right || y < vbox.top || y > vbox.bottom)
    resize(dbox = dbox.join(Sky.box(Math.min(x, 0), Math.min(y, 0), x, y)))
  dot({x, y, c, r})
}

window.onresize = () => resize(dbox)