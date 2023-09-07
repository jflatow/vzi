// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

import { iterateReader } from 'https://deno.land/std/streams/iterate_reader.ts';
import { writeAll, writeAllSync } from 'https://deno.land/std/streams/write_all.ts';
import { bundle } from 'https://deno.land/x/emit/mod.ts';

export type BundleType = 'classic' | 'module';
export type Code = string;

export function array<T>(x?: T | T[]): T[] {
  return x instanceof Array ? x : (x == undefined ? [] : [x]);
}

export function cleave(str: string, sep: string): [string, string] {
  const i = str.indexOf(sep);
  if (i < 0)
    throw new Error(`No separator '${sep}' in '${str}'`);
  return [str.slice(0, i), str.slice(i + 1)];
}

export function dataURL(data: string): URL {
  return new URL(`data:application/typescript;base64,${btoa(data)}`);
}

export class IO {
  static readonly Decoder = new TextDecoder;
  static readonly Encoder = new TextEncoder;

  static readChunks(reader: Deno.Reader): AsyncIterableIterator<Uint8Array> {
    return iterateReader(reader);
  }

  static async readSource(source: Code, type: BundleType = 'classic'): Promise<Code> {
    return (await bundle(dataURL(source), { type })).code;
  }

  static async readSourceFile(path: URL, type: BundleType = 'classic'): Promise<Code | undefined> {
    return (await bundle(path, { type })).code;
  }

  static async writeTextStream(stream: Deno.Writer, text: string): Promise<void> {
    return await writeAll(stream, IO.Encoder.encode(text));
  }

  static writeTextStreamSync(stream: Deno.WriterSync, text: string): void {
    return writeAllSync(stream, IO.Encoder.encode(text));
  }
}
