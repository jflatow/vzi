// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

import { DTEvent, DTPage, DTResult } from './dt.ts';
import { EXIT, isRefused, isReset } from './errors.ts';
import { ClientOpts, UserFlags } from './options.ts';
import { IO } from './util.ts';

// XXX pass through all help/docs
export const help = `
Quickly override \`render_event\`, and keep the browser open:

 echo hello | vzi -c 'Sky = require('sky'); render_event = (ev, doc) => Sky.$(doc.body).hl(ev)' -K
 echo hello | vzi -c 'd3 = require('d3'); render_event = (ev, doc) => d3.select(doc.body).selectAll('div').data(ev)' -K

Use a script file:

 cat events | vzi my-pipe.js

And/or run headlessly:

 cat events | vzi -H
`;

export function exit(reason: string, code?: number): never {
  IO.writeTextStreamSync(Deno.stderr, reason + '\n');
  Deno.exit(code);
}

export type Hence = (ev: DTEvent) => any;
export type Pending = [DTEvent, Hence][];
export type Target = { page: DTPage, fresh: boolean };

export class Client {
  opts: ClientOpts;
  pending: Pending;
  process?: Deno.ChildProcess;
  socket?: WebSocket;
  target?: Target;

  constructor(opts: ClientOpts) {
    this.opts = opts;
    this.pending = [];
  }

  trace(...args: any[]) {
    if (this.opts.verbosity > 0)
      console.trace(...args);
  }

  async init() {
    if (this.opts.just_browser) {
      await this.launchBrowser();
    } else {
      await this.maybeBrowser();
      await this.connectPage();
    }
  }

  async maybeBrowser() {
    try {
      const version = await this.remoteVersion();
      this.trace('Browser w/ version', version);
    } catch (_) {
      await this.launchBrowser();
    }
  }

  async launchBrowser() {
    // spawn an external browser process
    //  and workaround https://github.com/denoland/deno/issues/5501
    if (this.opts.keep_alive) {
      this.process = await this.opts.platform.browserDetached(this.opts);
    } else {
      this.process = await this.opts.platform.browserAttached(this.opts);
    }
  }

  async connectPage() {
    return new Promise(
      async (okay, fail) => {
        try {
          const { fresh, page } = this.target = await this.findPage();
          if (!page?.webSocketDebuggerUrl)
            return fail(`Page has no available debugging socket`);

          this.socket = new WebSocket(page.webSocketDebuggerUrl);
          this.socket.onopen = () => {
            const bootstrap = () => {
              okay(this.eval(`handle_init(${JSON.stringify(this.opts.www_conf)})`));
            };
            if (fresh) {
              this.send({ method: 'Page.enable' });
              this.send({ method: 'Page.navigate', params: { url: this.opts.page_url } });
              this.when({ method: 'Page.loadEventFired' }, bootstrap);
            } else { // assume its already loaded
              bootstrap();
            }
          }
          this.socket.onerror = (e) => console.error('socket error', e);
          this.socket.onmessage = (m) => this.recv(m);
        } catch (e) {
          fail(e);
        }
      }
    )
  }

  async findPage() {
    const hash = `#${this.opts.page_token}`;
    const existing = await this.remoteList() as DTPage[];
    for (const page of existing)
      if (new URL(page.url).hash == hash)
        return { fresh: false, page };

    const blank = existing.find(this.opts.platform.isRecyclable);
    const page = blank ?? await this.remoteNew();
    return { fresh: true, page };
  }

  async remoteList() {
    return await this.remoteJSON(`/json/list`);
  }

  async remoteNew() {
    return this.remoteJSON(`/json/new`, 'PUT');
  }

  async remoteVersion() {
    return this.remoteJSON(`/json/version`);
  }

  async remoteJSON(path: string, method = 'GET', retries = 10, delay = 333) {
    const url = this.opts.browser.resolve(path);
    return new Promise(
      (okay, fail) => {
        const attempt = async () => {
          if (retries-- < 1)
            return fail(`Failed to get ${url}: too many attempts`);
          try {
            const response = await fetch(url, { method, });
            const json = await response.json();
            okay(json);
          } catch (e) {
            if (isRefused(e)) {
              if (retries--)
                return setTimeout(attempt, delay);
              console.warn(`Failed to talk to browser (${url}): ${e}`);
            } else if (isReset(e)) {
              console.warn(`Connection terminated by browser (${url}): ${e}`);
              return okay(null);
            } else {
              console.warn(`Unexpected request error (${url}): ${e}`);
            }
            fail(e);
          }
        }
        attempt();
      }
    );
  }

  async report(result: DTResult, final: boolean) {
    if (this.opts.output == null)
      return;
    if (typeof this.opts.output == 'string') {
      await Deno.writeTextFile(this.opts.output, result.value);
    } else if (final) {
      await IO.writeTextStream(this.opts.output, result.value);
    }
  }

  async data(data: Uint8Array) {
    const enc = btoa(IO.Decoder.decode(data)); // NB: ugh
    const res = await this.eval(`handle_data("${enc}")`);
    await this.report(res, false);
  }

  async done() {
    if (!this.opts.just_browser) {
      const res = await this.eval('handle_done()');
      await this.report(res, true);
    }
    await this.destroy();
  }

  async when(event: DTEvent, hence?: Hence): Promise<DTEvent> {
    return new Promise(
      (okay, _fail) => {
        this.pending.push([event, hence ?? okay])
      })
  }

  async eval(expression: string) {
    const tagged = this.send({
      method: 'Runtime.evaluate',
      params: {
        expression: expression,
        returnByValue: true,
      },
    });
    const result = await this.when({ id: tagged.id });
    return result.result.result;
  }

  send(obj: object) {
    const tagged = {
      id: Math.floor(Math.random() * 1e9),
      ...obj
    };
    this.socket!.send(JSON.stringify(tagged));
    return tagged;
  }

  recv(msg: { data: string }) {
    const obj = JSON.parse(msg.data);
    this.pending.map(([ev, fun], i) => {
      for (let k in ev)
        if (ev[k] != obj[k])
          return;
      if (fun)
        fun(obj);
      this.pending.splice(i, 1);
    });
  }

  async destroy(): Promise<void> {
    this.trace('Destroying...');
    return new Promise(
      (okay, fail) => {
        if (this.opts.keep_alive)
          return okay();
        if (this.pending.length)
          return setTimeout(() => this.destroy().then(okay, fail), 100);
        try {
          this.process?.kill(); // mostly just in case we get EOF
        } catch (_) {}
        return okay();
      });
  }
}

export async function main(args: string[]) {
  const flags = new UserFlags(args);
  if (flags.unknown)
    return exit(UserFlags.usage(flags.unknown), EXIT.BAD_INPUT);
  if (flags.help)
    return exit(help);

  const opts = await ClientOpts.gather(flags);
  const client = new Client(opts);
  const reader = IO.readChunks(Deno.stdin);

  const interrupted = new Promise(
    (okay, fail) => {
      let interrupts = 0;
      Deno.addSignalListener('SIGINT', async () => {
        okay({ done: true, value: interrupts });
      });
    }
  );

  try {
    await client.init();
    while (!opts.just_browser) {
      const result = await Promise.race([reader.next(), interrupted]) as IteratorResult<Uint8Array> | IteratorResult<any>;
      if (result.done) {
        if (result.value && !opts.keep_alive)
          Deno.exit(EXIT.INTERRUPT);
        break; // EOF
      } else {
        await client.data(result.value);
      }
    }
    await client.done();
    Deno.exit(); // since sockets may still be waiting
  } catch (e) {
    client.trace(e);
    await client.destroy();
    exit(`(*) ${e}`, EXIT.UNKNOWN);
  }
}
