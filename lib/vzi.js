// Make these things generally available use in evaled functions
const Sky = require('sky')
const Sun = require('sky/sun')
const U = Sky.util, dfn = U.dfn, clip = U.clip;
const {min, max, log, log2, log10, sqrt, sin, cos} = Math, tau = 2 * Math.PI;

/* Other useful transforms */

const lat = (lat, tileSize = 256) => {
  let siny = clip(sin(lat * tau / 360), -0.9999, 0.9999)
  return log((1 + siny) / (1 - siny)) * (tileSize / Math.PI)
}
const lng = (lng, tileSize = 256) => lng * tileSize / 360;

/* This API is provided to pipes for convenience. */

const indexOrEvalFun = (p, d, number = true) => {
  // parse param `p` as an index, or a function of `$`,`i` to evaluate
  // fallback to `d` if undefined
  if (p == undefined)
    return d;
  let k = parseInt(p)
  if (isNaN(k))
    return ($, i) => eval(p) // NB: use a flamboyant variable for cli
  if (number)
    return (parts, i) => parseFloat(parts[k])
  return (parts, i) => parts[k]
}

const maybeEvalFun = (p, d) => {
  // parse param `p` as a function of `_` to evaluate
  if (p == undefined)
    return d;
  return (_) => eval(p)
}

class ColorMap {
  constructor() {
    this.colors = []
    this.lookup = {}
  }

  obtain(c, a = 1, create = () => null) {
    if (!(c in this.lookup)) {
      let rgb = Sky.rgb(...['r', 'g', 'b'].map(() => U.randInt(0, 255)), a)
      this.lookup[c] = this.colors.push(rgb) - 1;
      create(rgb, c)
    }
    return this.colors[this.lookup[c]]
  }
}

module.exports = {
  lat: lat,
  lng: lng,
  indexOrEvalFun,
  maybeEvalFun,
  ColorMap
}