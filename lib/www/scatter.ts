// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// @ts-nocheck
import * as vzi from '../vzi.ts';

const { Sky, Sun, Components, Gestures } = vzi.SDK;
const { Wagon } = Components;
const { P, clip, dfn } = Sky;
const tau = 2 * Math.PI;
const {
  x: xp,
  y: yp,
  r: rp,
  c: cp,
  xs,
  ys,
  alpha = .1,
  split = '\\s+',
  xMin = -Infinity,
  xMax = +Infinity,
  yMin = -Infinity,
  yMax = +Infinity,
} = Conf.define;

const xVal = vzi.indexOrEvalFun(xp, (ev, i) => dfn(parseFloat(ev[1]), i));
const yVal = vzi.indexOrEvalFun(yp, (ev, i) => dfn(parseFloat(ev[0]), 0));
const rVal = vzi.indexOrEvalFun(rp, (ev, i) => 4);
const cVal = (ev, i) => ev[cp] || '-';
const xStr = vzi.maybeEvalFun(xs, (x) => x.toFixed(2));
const yStr = vzi.maybeEvalFun(ys, (y) => y.toFixed(2));

let head, body, main, labels, canvas, ctx, fctx;
let colorLabels, xyLabels, originLabel, skipLabel;
let cbox, dbox, vbox, skips = 0;
let colorMap = new vzi.ColorMap(alpha);

function dot({ x, y, c, r }) {
  const { x: cx, y: cy } = dataToCanvas({ x, y });
  ctx.fillStyle = colorMap.colorIn(c, colorLabels);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, tau);
  ctx.fill();
}

function resize(x, y) {
  const real = canvas.node, fake = fctx.canvas;

  // add the new data point
  dbox = dbox.join(Sky.box(Math.min(x, 0), Math.min(y, 0), x, y));

  // copy the real canvas to the fake one temporarily
  fake.width = real.width;
  fake.height = real.height;
  fctx.setTransform(1, 0, 0, -1, 0, cbox.h);
  fctx.drawImage(real, 0, 0);

  // update the bounds for the canvas box that we will draw inside
  cbox = canvas.bbox();
  real.width = cbox.w;
  real.height = cbox.h;
  ctx.setTransform(1, 0, 0, -1, 0, cbox.h);

  // find vbox containing dbox + 10% that has desired aspect ratio
  const vbox_ = vbox.copy();
  vbox = dbox.pad(dbox.h / 10 || 1, dbox.w / 10 || 1).closure(cbox);
  console.debug(`resizing view to ${vbox.w} x ${vbox.h} at ${vbox.x}, ${vbox.y}`);

  // if vbox_ were in cbox instead of vbox, where exactly would it be?
  const cbox_ = vbox_.analog(cbox, vbox);

  // copy the image back to exactly that spot
  ctx.drawImage(fake, cbox_.x, cbox_.y, cbox_.w, cbox_.h);

  // mark the origin
  let { x: ox, y: oy } = dataToViewport({ x: 0, y: 0 }), o = originLabel.node;
  originLabel.xy(ox, oy);

  // save the changes
  main.attrs({
    'data-dbox': dbox,
    'data-vbox': vbox,
  });
}

function dataToCanvas({x, y}) {
  return {
    x: cbox.x + cbox.w * (x - vbox.x) / vbox.w,
    y: cbox.y + cbox.h * (y - vbox.y) / vbox.h,
  };
}

function canvasToData({x, y}) {
  return {
    x: vbox.x + vbox.w * (x - cbox.x) / cbox.w,
    y: vbox.y + vbox.h * (y - cbox.y) / cbox.h,
  };
}

function dataToViewport({x, y}) {
  return {
    x: cbox.x + cbox.w * (x - vbox.x) / vbox.w,
    y: cbox.y + cbox.h * (vbox.h - y + vbox.y) / vbox.h,
  };
}


function viewportToData({x, y}) {
  return {
    x: vbox.x + vbox.w * (x - cbox.x) / cbox.w,
    y: vbox.y + vbox.h * (cbox.h - y + cbox.y) / cbox.h,
  };
}

window.render_begin = (doc, i) => {
  head = Sky.$(doc.head);
  head.unique('#styles', (head) => {
    return head.child('style', { id: 'styles' }).addRules({
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
    });
  });

  body = Sky.$(doc.body);
  main = body.unique('main', (p) => p.child('main'));

  labels = main.unique('#labels', (p) => p.div({ id: 'labels' }));
  canvas = main.unique('#canvas', (p) => p.child('canvas', { id: 'canvas' }));

  const ddbox = main.attr('data-dbox');
  const dvbox = main.attr('data-vbox');

  cbox = canvas.bbox();
  dbox = window.eval(`Sky.box(${ddbox || '0,0,0,0'})`);
  vbox = window.eval(`Sky.box(${dvbox || '0,0,1,1'})`);

  ctx = canvas.node.getContext('2d');
  fctx = doc.createElement('canvas').getContext('2d');

  colorLabels = labels.unique('#colors', (p) => p.div({ id: 'colors' }));
  colorLabels.colorLabelData(colorMap, alpha);
  !i && Gestures.swipe(colorLabels, new Wagon(colorLabels));

  xyLabels = labels.unique('#xys', (p) => p.div({ id: 'xys' }));
  originLabel = labels.unique('#origin', (p) => p.div({ id: 'origin' }));

  skipLabel = labels.unique('#skips', (p) => p.div({ id: 'skips', class: 'label' }));
  !i && Gestures.swipe(skipLabel, new Wagon(skipLabel));

  const xLabel = xyLabels.unique('#xLabel', (p) => p.div({ id: 'xLabel', class: 'label' }));
  const yLabel = xyLabels.unique('#yLabel', (p) => p.div({ id: 'yLabel', class: 'label' }));
  const update = (e) => {
    const { x, y } = viewportToData({
      x: e.pageX - e.target.offsetLeft,
      y: e.pageY - e.target.offsetTop,
    });
    xLabel.txt(`x = ${xStr(x)}`);
    yLabel.txt(`y = ${yStr(y)}`);
    xyLabels.xy(
      e.pageX + (e.pageX > cbox.midX ? -(xyLabels.bbox().w + 16) : 16),
      e.pageY - xyLabels.bbox().h / 2,
    );
  };
  !i && canvas.on('mouseenter', update);
  !i && canvas.on('mousemove', Sun.throttle(update, 5));
  resize();
}

window.render_event = (event, doc, i) => {
  const x = clip(xVal(event, i), xMin, xMax);
  const y = clip(yVal(event, i), yMin, yMax);
  const r = rVal(event, i);
  const c = cVal(event, i);

  if (!isFinite(x) || !isFinite(y))
    return skipLabel.txt(`${skips++} skipped`);

  if (x < vbox.left || x > vbox.right || y < vbox.top || y > vbox.bottom)
    resize(x, y);
  dot({ x, y, c, r });
}

window.onresize = () => resize();