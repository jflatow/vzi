// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

// since Deno won't tell us signal numbers...
//  https://github.com/denoland/deno/issues/20408
export enum EXIT {
  UNKNOWN = 1,
  BAD_INPUT = 2,
  INTERRUPT = 128 + 2,
}

export function isRefused(e: Error): boolean {
  // incorrectly matching errors
  //  https://github.com/denoland/deno/issues/20394
  if (/refused/i.test(e.message))
    return true;
  return false;
}

export function isReset(e: Error): boolean {
  // incorrectly matching errors
  //  https://github.com/denoland/deno/issues/20394
  if (/reset/i.test(e.message))
    return true;
  return false;
}

