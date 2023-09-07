// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// Make these things generally available to use in evaled functions
import * as SDK from 'https://raw.githubusercontent.com/jflatow/sdk/master/sdk.ts';
import { Sky, Sun } from 'https://raw.githubusercontent.com/jflatow/sdk/master/sdk.ts';
export { Sky, Sun, SDK };

export const { dfn, clip, rgb, rgb: rgba } = Sky;
export const { pad, throttle, Time: T } = Sun;
export const { min, max, exp, log, log2, log10, sqrt, sin, cos } = Math, tau = 2 * Math.PI;

export type Doc = Sky.Node;
export type Event = any;
export type Fun = (...args: any[]) => any;

/* Other useful transforms */

export function lat(lat: number, tileSize = 256) {
  const siny = clip(sin(lat * tau / 360), -0.9999, 0.9999);
  return log((1 + siny) / (1 - siny));
}

export function lng(lng: number) {
  return lng / 30;
}

export function hour(unix: number, unit = 1): string {
  const d = new Date(unix * 1000);
  return `${T.datestamp(d, {utc: true})} ${pad(unit * ~~(d.getUTCHours() / unit))}:00`;
}

export function minute(unix: number, unit = 1): string {
  const d = new Date(unix * 1000);
  return `${T.datestamp(d, {utc: true})} ${pad(d.getUTCHours())}:${pad(unit * ~~(d.getUTCMinutes() / unit))}`;
}

export function second(unix: number, unit = 1): string {
  const d = new Date(unix * 1000);
  return `${T.datestamp(d, {utc: true})} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(unit * ~~(d.getUTCSeconds() / unit))}`;
}

/* This API is provided to pipes for convenience. */

export function topK<V extends number | bigint>(hist: { [_: string]: V }, K?: number): [string, V][] {
  const entries = Object.entries(hist);
  if (K == undefined)
    return entries;
  return entries.sort((a, b) => a[1] - b[1]).slice(K);
}

export function tryNum(s: any): any {
  if (isNaN(s)) {
    const t = Date.parse(s);
    if (Number.isNaN(t))
      return s;
    return new Date(t);
  }
  return Number(s);
}

export function maybeTryNumFun(f: Fun, num: boolean): Fun {
  if (num)
    return (...args) => tryNum(f(...args));
  return f;
}

export function indexOrEvalFun(p?: any, d?: Fun, num: boolean = true): ($: any, i?: number) => any {
  // treat param `p` as an index, or a function of `$`,`i` to evaluate
  // fallback to `d` if undefined
  if (p == undefined)
    return maybeTryNumFun(d!, num);
  if (isNaN(p)) {
    const f = new Function('$', 'i', `return ${p}`) as any; // NB: use a flamboyant variable for cli
    return maybeTryNumFun(f, num);
  }
  return maybeTryNumFun((parts, i) => parts[p], num);
}

export function maybeEvalFun(p?: string, d?: Fun): (_: any) => any {
  // parse param `p` as a function of `_` to evaluate
  if (p == undefined)
    return d!;
  return new Function('_', `return ${p}`) as any; // NB: a different flamboyant variable
}

export class ColorMap {
  alpha: number;
  colors: Sky.RGB[];
  lookup: { [name: string]: number };

  constructor(alpha: number) {
    this.alpha = alpha;
    this.colors = [];
    this.lookup = {};
  }

  obtain(
    name: string,
    create = (...args: any[]) => null,
    choose = (a: number) => Sky.RGB.random().alpha(a)
  ) {
    if (!(name in this.lookup)) {
      const rgb = choose(this.alpha);
      this.lookup[name] = this.colors.push(rgb) - 1;
      create(rgb, name);
    }
    return this.colors[this.lookup[name]];
  }

  colorIn(name: string, colorLabels: any) {
    return this.obtain(name, (rgb) => colorLabels.colorLabel(rgb, name));
  }
}

Sky.Elem.prototype.update({
  colorLabel(rgb: any, name: string): Sky.Elem {
    const div = this.row(['1em', '1ex', 'fit']).addClass('color');
    div.nth(0).style({ width: '1em', height: '1em', backgroundColor: new Sky.RGB(rgb).alpha(1) });
    div.nth(2).attrs({ class: 'label' }).txt(name);
    return div.attrs({ 'data-name': btoa(name), 'data-rgb': rgb });
  },

  colorLabelData(colorMap: ColorMap, alpha: number): ColorMap {
    this.each('.color', (node: Sky.Node) => {
      const elem = Sky.$(node);
      const name = atob(node.getAttribute('data-name'));
      const rgb = node.getAttribute('data-rgb');
      colorMap.obtain(name, () => elem, () => window.eval(rgb));
    });
    return colorMap;
  }
});

Sky.Box.prototype.update({
  analog(d: Sky.Box, s: Sky.Box): Sky.Box {
    // this box, if it were in system d instead of s
    const a = this, b = Sky.box();
    b.w = a.w * d.w / s.w;
    b.h = a.h * d.h / s.h;
    b.x = (a.x - s.x) * d.w / s.w + d.x;
    b.y = (a.y - s.y) * d.h / s.h + d.y;
    return b;
  },

  closure(like: Sky.Box): Sky.Box {
    // smallest box that contains this one and is proportional to like
    if (like.w > like.h)
      return this.copy({w: this.h * like.w / like.h}).center(this.midX, this.midY);
    return this.copy({h: this.w * like.h / like.w}).center(this.midX, this.midY);
  },
});

// Hack to add all exports to the [window](./window.ts)
import * as _ from './window.ts';
