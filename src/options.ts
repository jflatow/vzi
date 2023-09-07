// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

import * as Flags from 'https://deno.land/std/flags/mod.ts';

import { DTPage } from './dt.ts';
import { array, cleave, Code, IO } from './util.ts';

export const LOCAL_PAGE_URI = 'www/index.html';
export const DEFAULT_PAGE_URI = 'http://vzi.sci.sh/host.html'; // may change

export type IP = string;
export type Hostname = string;
export type Portspec = string;

export type Output = Deno.Writer | string | null;

export type JSON = { [k: string]: JSON } | JSON[] | boolean | number | string;
export type Format = 'unix' | string;
export type Params = JSON;
export type Pipe = { cli?: Code, module?: Code, file?: Code }; // Q: all really?

export class UserFlags {
  declare 'browser-bind'?: IP;
  declare 'browser-host'?: Hostname;
  declare 'browser-path'?: string;
  declare 'browser-port'?: Portspec;
  declare 'cli'?: string;
  declare 'define'?: string | string[];
  declare 'format'?: 'unix';
  declare 'headless'?: boolean;
  declare 'help'?: boolean;
  declare 'just-browser'?: boolean;
  declare 'keep-alive'?: boolean;
  declare 'let-die'?: boolean;
  declare 'module'?: string;
  declare 'no-output'?: boolean;
  declare 'output'?: string;
  declare 'page-local'?: boolean;
  declare 'page-token'?: string;
  declare 'page-uri'?: string;
  declare 'separator'?: string;
  declare 'verbosity'?: string;
  declare 'unknown'?: string;
  declare '_': string[];

  static readonly FlagSpec = {
    alias: {
      'B': 'browser-bind',
      'b': 'browser-path',
      'c': 'cli',
      'd': 'define',
      'f': 'format',
      'h': 'help',
      'H': 'headless',
      'J': 'just-browser',
      'K': 'keep-alive',
      'L': 'let-die',
      'l': 'page-local',
      'm': 'module',
      'O': 'no-output',
      'o': 'output',
      'P': 'page-token',
      'p': 'browser-port',
      'R': 'browser-host',
      's': 'separator',
      'u': 'page-uri',
      'V': 'verbosity',
    },

    boolean: [
      'help',
      'headless',
      'just-browser',
      'let-die',
      'keep-alive',
      'no-output',
      'page-local',
    ],

    collect: [
      'define'
    ],
  };

  static usage(unknown: string): string {
    // XXX incomplete
    // XXX use unknown?
    return 'USAGE: vzi [-h] [-H] ([-c PIPE] | [PIPE.js]) ([-O] | [-o OUT]) [-p PORT]';
  }

  constructor(args: string[]) {
    let unknown;
    const spec = {
      ...UserFlags.FlagSpec,
      unknown(opt: string) {
        if (opt[0] != '-')
          return true; // not opt-ish, add it to argv
        unknown = opt;
      }
    };
    const flags = Flags.parse(args, spec);
    this.validate(flags);
    Object.assign(this, flags, { unknown });
  }

  validate(flags: any) {
    if (flags['let-die'] && flags['just-browser'])
      throw new Error("Why do you want to `let-die` AND `just-browser`?");
    if (flags['let-die'] && flags['keep-alive'])
      throw new Error("You need to pick one: `let-die` OR `keep-alive`?");
    if (flags['page-local'] && flags['page-uri'])
      throw new Error("Do you want `page-local` OR to specify the `page-uri`?");
  }
}

export class BrowserOpts {
  declare path: string;
  declare bind: IP;
  declare host: Hostname;
  declare port: Portspec;

  constructor(opts: any) {
    Object.assign(this, opts); // Q: worth spelling out?
  }

  resolve(path: string): URL {
    return new URL(path, `http://${this.host}:${this.port}`);
  }
}

export class ClientOpts {
  declare flags: UserFlags;
  declare browser: BrowserOpts;
  declare platform: Platform;
  declare root: URL;
  declare is_headless: boolean;
  declare just_browser: boolean;
  declare keep_alive: boolean;
  declare output: Output;
  declare page_token: string;
  declare page_url: URL;
  declare www_conf: WWW;
  declare verbosity: number;

  static async gather(flags: UserFlags): Promise<ClientOpts> {
    const root = new URL('..', import.meta.url);
    const browser = new BrowserOpts({
      path: flags['browser-path'] ?? null,
      bind: flags['browser-bind'] ?? '127.0.0.1',
      host: flags['browser-host'] ?? 'localhost',
      port: flags['browser-port'] ?? '9222',
    });
    const platform = await Platform.configure(flags);
    const is_headless = !!flags['headless'];
    const just_browser = !!flags['just-browser'];
    const keep_alive =
      flags['let-die'] ? false :
      flags['keep-alive'] ? true :
      just_browser ? true :
      is_headless ? false : true;
    const output =
      flags['no-output'] ? null :
      flags['output'] ? flags.output : Deno.stdout;
    const page_token = flags['page-token'] ?? Math.floor(Math.random() * 1e16);
    const page_uri =
      flags['page-uri'] ? flags['page-uri'] :
      flags['page-local'] ? LOCAL_PAGE_URI : DEFAULT_PAGE_URI;
    const page_url = new URL(`${page_uri}#${page_token}`, root);
    const www_conf = await WWW.configuration(flags, root);
    const verbosity = parseInt(flags['verbosity'] ?? '0');
    return new ClientOpts({
      flags,
      root,
      browser,
      platform,
      is_headless,
      just_browser,
      keep_alive,
      output,
      page_token,
      page_url,
      www_conf,
      verbosity,
    });
  }

  constructor(opts: any) {
    Object.assign(this, opts); // Q: worth spelling out?
  }
}

export abstract class Platform {
  static async configure(_flags: UserFlags) {
    switch (Deno.build.os) {
      case 'darwin':
        return new PlatformDarwin;
      default:
        return new PlatformGeneric;
    }
  }

  abstract browserAttached(opts: ClientOpts): Promise<Deno.ChildProcess>;
  abstract browserDetached(opts: ClientOpts): Promise<Deno.ChildProcess>;

  abstract isRecyclable(page: DTPage): boolean;
}

export class PlatformGeneric extends Platform {
  async browserAttached(opts: ClientOpts) {
    // we inherit browser stdout/stderr here (but nullify stdout for now)
    const cmd = this.browserPath(opts), args = this.chromeArgs(opts);
    const command = new Deno.Command(cmd, {
      args,
      stdout: 'null', // ideally would redirect to stderr (for browser)
    });
    const process = command.spawn();
    return process;
  }

  async browserDetached(opts: ClientOpts) {
    // we forfeit rights to browser stdout/stderr here now
    const cmd = this.daemonCmd(opts), args = this.daemonArgs(opts);
    const command = new Deno.Command(cmd, {
      args,
      stdout: 'null', // ideally would redirect to stderr (for wrapper)
    });
    const process = command.spawn();
    const status = await process.status;
    if (!status.success)
      throw new Error(`Browser command failed with status ${status.code} (${[cmd, ...args].join(' ')})`);
    return process;
  }

  browserPath(opts: ClientOpts): string {
    if (opts.browser.path == undefined)
      throw new Error(`No guess for browser path on ${Deno.build.os}, please advise`);
    return opts.browser.path;
  }

  chromeArgs(opts: ClientOpts): string[] {
    const args = [
      `--no-default-browser-check`,
      `--no-first-run`,
      `--remote-debugging-address=${opts.browser.bind}`, // NB: chrome ignores if not headless
      `--remote-debugging-port=${opts.browser.port}`,
    ];
    if (opts.is_headless)
      args.push('--headless', '--disable-gpu'); // Q: will --headless=new allow bind?
    return args;
  }

  daemonArgs(opts: ClientOpts): string[] {
    return [this.browserPath(opts), ...this.chromeArgs(opts)];
  }

  daemonCmd(opts: ClientOpts): string {
    return 'daemonize';
  }

  isRecyclable(page: DTPage): boolean {
    return page.url == 'chrome://newtab/';
  }
}

export class PlatformDarwin extends PlatformGeneric {
  browserPath(opts: ClientOpts): string {
    return opts.browser.path ?? '/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary';
  }

  daemonArgs(opts: ClientOpts): string[] {
    return ['-a', this.browserPath(opts), '--args', ...this.chromeArgs(opts)];
  }

  daemonCmd(opts: ClientOpts): string {
    return 'open';
  }
}

export class WWW /* implements JSON */ {
  declare always: boolean;
  declare define: Params;
  declare format: Format;
  declare pipe: Pipe;
  declare separator: string | null;

  static async configuration(flags: UserFlags, root: URL): Promise<WWW> {
    return {
      always: flags.output ? true : false,
      define: await WWW.defineParams(flags),
      format: await WWW.determineFormat(flags),
      pipe: await WWW.determinePipe(flags, root),
      separator: flags.separator ?? null,
    };
  }

  static async defineParams(flags: UserFlags): Promise<Params> {
    const defs = array(flags.define).reduce((a, d) => a.concat(array(d)), [] as string[]);
    const define = {} as any;
    for (const def of defs) {
      const [name, val] = cleave(def, '=');
      const num = parseFloat(val);
      const mnum = isNaN(num) ? val : num;
      if (name in define)
        define[name] = array(define[name]).concat(mnum);
      else
        define[name] = mnum;
    }
    return define;
  }

  static async determineFormat(flags: UserFlags): Promise<Format> {
    return flags.format || 'unix';
  }

  static async determinePipe(flags: UserFlags, root: URL): Promise<Pipe> {
    if (flags['cli'])
      return { cli: await IO.readSource(flags.cli) };
    if (flags['module'])
      return { module: await IO.readSourceFile(new URL(`lib/www/${flags.module}.ts`, root)) };
    if (flags._[0])
      return { file: await IO.readSourceFile(new URL(flags._[0], `file://${Deno.cwd()}`)) };
    return {};
  }
}
