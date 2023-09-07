// Copyright 2017-present Jared Flatow
// SPDX-License-Identifier: AGPL-3.0-only

import * as vzi from './vzi.ts';

// Generally allow assignment to window
declare global {
  interface Window {
    [key: string]: any;
  }
}

// Everything exported by the main lib gets added to the window for eval
// In part because we can no longer use `eval` and must use `window.eval`:
//  https://github.com/denoland/deno_emit/issues/136
// However, its also a bit more consistent experience for places we call `eval`
if ('vziAutoExport' in window)
  Object.assign(window, vzi);
