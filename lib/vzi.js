// Make these things generally available use in evaled functions
const Sky = require('sky')
const Sun = require('sky/sun')
const U = Sky.util, {dfn, clip} = U;
const T = Sun.time, {pad} = Sun;
const {min, max, log, log2, log10, sqrt, sin, cos} = Math, tau = 2 * Math.PI;

/* Other useful transforms */

const lat = (lat, tileSize = 256) => {
  let siny = clip(sin(lat * tau / 360), -0.9999, 0.9999)
  return log((1 + siny) / (1 - siny)) * (tileSize / Math.PI)
}
const lng = (lng, tileSize = 256) => lng * tileSize / 360;

const rgb = (r, g, b, a) => Sky.rgb(r, g, b, a)
const rgba = (r, g, b, a) => Sky.rgb(r, g, b, a)

const hour = (unix, unit = 1) => {
  let d = new Date(unix * 1000)
  return `${T.datestamp(d, {utc: true})} ${pad(unit * ~~(d.getUTCHours() / unit))}:00`
}
const minute = (unix, unit = 1) => {
  let d = new Date(unix * 1000)
  return `${T.datestamp(d, {utc: true})} ${pad(d.getUTCHours())}:${pad(unit * ~~(d.getUTCMinutes() / unit))}`
}
const second = (unix, unit = 1) => {
  let d = new Date(unix * 1000)
  return `${T.datestamp(d, {utc: true})} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(unit * ~~(d.getUTCSeconds() / unit))}`
}

/* This API is provided to pipes for convenience. */

const topK = (hist, K) => {
  let entries = Object.entries(hist)
  if (K == undefined)
    return entries;
  return entries.sort((a, b) => hist[a] - hist[b]).slice(K)
}

const tryNum = (s) => {
  if (isNaN(s))
    return s;
  let x = parseFloat(s)
  if (Number.isNaN(x))
    return undefined;
  return x;
}

const indexOrEvalFun = (p, d, number = true) => {
  // parse param `p` as an index, or a function of `$`,`i` to evaluate
  // fallback to `d` if undefined
  if (p == undefined)
    return d;
  let k = parseInt(p)
  if (isNaN(k))
    return ($, i) => eval(p) // NB: use a flamboyant variable for cli
  if (number == 'try')
    return (parts, i) => tryNum(parts[k])
  if (number)
    return (parts, i) => parseFloat(parts[k])
  return (parts, i) => parts[k]
}

const maybeEvalFun = (p, d) => {
  // parse param `p` as a function of `_` to evaluate
  if (p == undefined)
    return d;
  return (_) => eval(p) // NB: a different flamboyant variable
}

class ColorMap {
  constructor(alpha) {
    this.alpha = alpha
    this.colors = []
    this.lookup = {}
  }

  obtain(name,
         create = () => null,
         choose = (a) => Sky.RGB.random().alpha(a)) {
    if (!(name in this.lookup)) {
      let rgb = choose(this.alpha)
      this.lookup[name] = this.colors.push(rgb) - 1;
      create(rgb, name)
    }
    return this.colors[this.lookup[name]]
  }

  colorIn(name, colorLabels) {
    return this.obtain(name, (rgb) => colorLabels.colorLabel(rgb, name))
  }
}

Sky.Elem.prototype.update({
  colorLabel: function (rgb, name) {
    let div = this.row(['1em', '1ex', 'fit']).addClass('color')
    div.nth(0).style({width: '1em', height: '1em', backgroundColor: new Sky.RGB(rgb).alpha(1)})
    div.nth(2).attrs({class: 'label'}).txt(name)
    return div.attrs({'data-name': btoa(name), 'data-rgb': rgb})
  },

  colorLabelData: function (colorMap, alpha) {
    this.each('.color', (node) => {
      let elem = Sky.$(node),
          name = node.getAttribute('data-name'),
          rgb = node.getAttribute('data-rgb')
      colorMap.obtain(name, () => elem, () => eval(rgb))
    })
    return colorMap;
  }
})

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

module.exports = {
  lat,
  lng,
  rgb,
  rgba,
  hour,
  minute,
  second,
  topK,
  indexOrEvalFun,
  maybeEvalFun,
  ColorMap
}