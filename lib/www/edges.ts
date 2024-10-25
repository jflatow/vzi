// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// @ts-nocheck
import * as vzi from '../vzi.ts';

const { Sky, Sun, Components, Gestures } = vzi.SDK;
const { P } = Sky;

let head, style, body, main, labels, graph;
let diagram;

class Diagram {
  constructor(node) {
    this.animate = Sun.throttle(() => window.requestAnimationFrame(() => this.draw()), 1);
    this.colorMap = new vzi.ColorMap;
    this.elem = Sky.$(node);
    this.nodes = {};
    this.edges = [];
  }

  add(event) {
    const source = event[0];
    const target = event[1];
    const label = event[2];
    const sNode = this.nodes[source] = this.nodes[source] ?? { i: 0, o: 0 };
    const tNode = this.nodes[target] = this.nodes[target] ?? { i: 0, o: 0 };
    sNode.o++;
    tNode.i++;
    this.edges.push({ source, target, label });
    this.animate();
  }

  draw() {
    const gSources = this.elem.unique('.sources', (p) => p.g({ class: 'sources' }));
    const gTargets = this.elem.unique('.targets', (p) => p.g({ class: 'targets' }));
    const gEdges = this.elem.unique('.edges', (p) => p.g({ class: 'edges' }));

    const nodes = Object.entries(this.nodes);
    nodes.sort((a, b) => (a[1].i - a[1].o) - (b[1].i - b[1].o));

    const viewBox = Sky.box(0, 0, window.innerWidth, 25 * nodes.length).trim(10);
    const cols = viewBox.split({ cols: 6 });

    const index = nodes.reduce((acc, [name, _], i) => ({ [name]: i, ...acc }), {});

    const sboxs = cols[0].split({ rows: nodes.length });
    const tboxs = cols[cols.length - 1].split({ rows: nodes.length });

    const edges = this.edges;
    const oEdges = edges.reduce((acc, edge, i) => {
      return (acc[edge.source] = (acc[edge.source] ?? [])).push(i), acc;
    }, {});
    const iEdges = edges.reduce((acc, edge, i) => {
      return (acc[edge.target] = (acc[edge.target] ?? [])).push(i), acc;
    }, {});

    const nElems = nodes.reduce((acc, node, i) => {
      const s = gSources.textX(sboxs[i], node[0], +1)
        .style({ cursor: 'pointer' })
        .on('mouseover', () => {
        nElems.forEach(([s_, t_], j) => {
          s_.style({ opacity: i == j ? 1 : 0.5 });
          t_.style({ opacity: 0.5 });
        });
        oEdges[node[0]].forEach((j) => {
          nElems[index[edges[j].target]][1].style({ opacity: 1 });
        });
      });
      const t = gTargets.textX(tboxs[i], node[0], -1)
        .style({ cursor: 'pointer' })
        .on('mouseout', () => {
        nElems.forEach(([s_, t_], j) => {
          s_.style({ opacity: 0.5 });
          t_.style({ opacity: i == j ? 1 : 0.5 });
        });
        iEdges[node[0]].forEach((j) => {
          nElems[index[edges[j].source]][0].style({ opacity: 1 });
        });
      });
      return acc.push([s, t]), acc;
    }, []);

    const eElems = edges.map((edge) => {
      const si = index[edge.source];
      const ti = index[edge.target];
      const sbox = sboxs[si];
      const tbox = tboxs[ti];
      return gEdges.path()
        .style({ stroke: this.colorMap.obtain(edge.label) })
        .attrs({ d: P.M([sbox.right, sbox.midY]) + P.L([tbox.left, tbox.midY]) });
    });

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
      },

      'body': {
        'margin': 0,
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
}

export function render_event(event, doc, i) {
  diagram.add(event);
}

// can be used as a module itself:
window.render_begin = render_begin;
window.render_event = render_event;

