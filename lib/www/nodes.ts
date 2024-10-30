// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// @ts-nocheck
import * as vzi from '../vzi.ts';

const { Sky, Sun, Components, Gestures } = vzi.SDK;
const { Wagon } = Components;
const { P } = Sky;

let head, style, body, main, labels, graph;
let diagram, colorLabels;

function nodeKey({ name, group }) {
  return [name, group].join(',');
}

function parseNode(desc: string) {
  const [name, group] = desc.split(',');
  return { name, group };
}

function ringLayout(N: number) {
  const L = Math.floor(Math.sqrt(N - 1));
  const R = [L == 1 ? N : 1];
  for (let l = 1, r, s = R[0]; l < L; l++, s += r) {
    if (l == L - 1) {
      R.push(r = N - s);
    } else if (l == 1) {
      R.push(r = 4);
    } else {
      R.push(r = 2 * (l + 1));
    }
  };
  return R;
}

class Diagram {
  constructor(node) {
    this.animate = Sun.throttle(() => window.requestAnimationFrame(() => this.draw()), 1);
    this.colorMap = new vzi.ColorMap;
    this.elem = Sky.$(node);
    this.nodes = {};
    this.edges = [];
  }

  add(event) {
    const source = parseNode(event[0]);
    const target = parseNode(event[1]);
    const label = event[2];
    const sGroup = this.nodes[source.group] = this.nodes[source.group] ?? { i: 0, o: 0, members: {} };
    const tGroup = this.nodes[target.group] = this.nodes[target.group] ?? { i: 0, o: 0, members: {} };
    const sNode = sGroup.members[source.name] = sGroup.members[source.name] ?? { i: 0, o: 0 };
    const tNode = tGroup.members[target.name] = tGroup.members[target.name] ?? { i: 0, o: 0 };
    sGroup.o++;
    tGroup.i++;
    sNode.o++;
    tNode.i++;
    this.edges.push({ source, target, label });
    this.animate();
  }

  draw() {
    const gEdges = this.elem.unique('.edges', (p) => p.g({ class: 'edges' })).clear(); // XXX make all idempotent
    const gNodes = this.elem.unique('.nodes', (p) => p.g({ class: 'nodes' })).clear(); // XXX make all idempotent
    const viewBox = Sky.box(0, 0, window.innerWidth, window.innerHeight).trim(20);
    const cx = viewBox.midX, cy = viewBox.midY;
    const groups = Object.entries(this.nodes).sort((a, b) => (b[1].i + b[1].o) - (a[1].i + a[1].o));
    const rings = ringLayout(groups.length);
    const width = viewBox.w / rings.length / 2;
    const height = viewBox.h / rings.length / 2;
    for (let i = 0, k = 0; i < rings.length; i++) {
      const o = Math.random();
      for (let j = 0; j < rings[i]; j++) {
        const group = groups[k++];
        const z = rings[i] == 1 ? 0 : 1;
        const w = z * width * (i + 0.5);
        const h = z * height * (i + 0.5);
        const a = 2 * Math.PI * (j / rings[i] + o);
        const x = cx + w * Math.cos(a);
        const y = cy + h * Math.sin(a);
        const q = gNodes.g()
          .on('mouseover', () => {
            e.attrs({ 'fill-opacity': 0.8 });
            l.style({ 'opacity': 1 });
          })
          .on('mouseout', () => {
            e.attrs({ 'fill-opacity': 0 });
            l.style({ 'opacity': 0 });
          });
        const box = Sky.box(0, 0, width, height).center(x, y);
        const e = q.ellipseX(box.pad(30)).attrs({ 'fill-opacity': '0', 'fill': '#FFFAFA' });
        const l = q.text(group[0]).xy(x, y - height / 2).anchor(0, +1).style({ 'opacity': 0 });

        const cx_ = box.midX, cy_ = box.midY;
        const members = Object.entries(group[1].members).sort((a, b) => (b[1].i + b[1].o) - (a[1].i + a[1].o));
        const rings_ = ringLayout(members.length);
        const width_ = box.w / rings_.length / 2;
        const height_ = box.h / rings_.length / 2;
        for (let i_ = 0, k_ = 0; i_ < rings_.length; i_++) {
          const o_ = Math.random();
          for (let j_ = 0; j_ < rings_[i_]; j_++) {
            const member = members[k_++];
            const z_ = rings_[i_] == 1 ? 0 : 1;
            const w_ = z_ * width_ * (i_ + 0.5);
            const h_ = z_ * height_ * (i_ + 0.5);
            const a_ = 2 * Math.PI * (j_ / rings_[i_] + o_);
            const x_ = cx_ + w_ * Math.cos(a_);
            const y_ = cy_ + h_ * Math.sin(a_);
            const q_ = q.g()
              .style({ cursor: 'pointer '})
              .on('mouseover', () => {
                e_.attrs({ 'fill-opacity': 0.8 });
                l_.style({ 'opacity': 1 });
                gEdges.each(`[data-source="${member[0]},${group[0]}"]`, (n) => Sky.$(n).attrs({ 'stroke-width': 4 }));
                gEdges.each(`[data-target="${member[0]},${group[0]}"]`, (n) => Sky.$(n).attrs({ 'stroke-width': 4 }));
              })
              .on('mouseout', () => {
                e_.attrs({ 'fill-opacity': 0 });
                l_.style({ 'opacity': 0.8 });
                gEdges.each(`[data-source="${member[0]},${group[0]}"]`, (n) => Sky.$(n).attrs({ 'stroke-width': 1 }));
                gEdges.each(`[data-target="${member[0]},${group[0]}"]`, (n) => Sky.$(n).attrs({ 'stroke-width': 1 }));
              });
            const box_ = Sky.box(0, 0, 25, 25).center(x_, y_);
            const e_ = q_.ellipseX(box_.pad(10)).attrs({ 'fill-opacity': '0', 'fill': '#CCCDDD' });
            const l_ = q_.text(member[0]).xy(x_, y_).anchor(0, 0).style({ 'opacity': 0.8 });
            this.nodes[group[0]].members[member[0]].box = Sky.box(0, 0, width_, height_).center(x_, y_);
          }
        }
      }
    }

    for (const edge of this.edges) {
      const sNode = this.nodes[edge.source.group].members[edge.source.name];
      const tNode = this.nodes[edge.target.group].members[edge.target.name];
      const sbox = sNode.box;
      const tbox = tNode.box;
      gEdges.path()
        .style({
          fill: 'none',
          stroke: this.colorMap.colorIn(edge.label, colorLabels),
        })
        .attrs({
          d: P.M([sbox.midX, sbox.midY]) +
            P('Q',
              (sbox.midX + tbox.midX) / 2 + (tbox.midX - sbox.midX) * (Math.random() - 0.5),
              (sbox.midY + tbox.midY) / 2 + (tbox.midY - sbox.midY) * (Math.random() - 0.5),
              tbox.midX, tbox.midY),
          'data-source': nodeKey(edge.source),
          'data-target': nodeKey(edge.target),
        })
    }

    this.elem.attrs({ viewBox });
  }
}

export function render_begin(doc, i) {
  head = Sky.$(doc.head);
  style = head.unique('style', (head) => {
    const style = head.child('style');
    style.addRules({
      '*': {
        'box-sizing': 'border-box',
        'font-family': 'monospace',
      },

      'body': {
        'margin': 0,
      },

      '#colors': {
        'position': 'fixed',
        'top': '1ex',
        'left': '1ex',
      },

      '#graph': {
        'width': '100vw',
        'height': '100vh',
      },
    });
    return style;
  });

  body = Sky.$(doc.body);
  main = body.unique('main', (p) => p.child('main'));

  labels = main.unique('#labels', (p) => p.div({ id: 'labels' }));
  graph = main.unique('#graph', (p) => p.svg({ id: 'graph' }));

  diagram = new Diagram(graph.node);
  colorLabels = labels.unique('#colors', (p) => p.div({ id: 'colors' }));
  colorLabels.colorLabelData(diagram.colorMap, 0.8);
  !i && Gestures.swipe(colorLabels, new Wagon(colorLabels));
}

export function render_event(event, doc, i) {
  diagram.add(event);
}

// can be used as a module itself:
window.render_begin = render_begin;
window.render_event = render_event;

