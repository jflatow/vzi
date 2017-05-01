# vzi

`vzi` is the spiritual successor to [viz <img src="http://www.flatown.com/img/viz.png" width="24" height="24" align="top">](https://github.com/jflatow/viz)

`vzi` command line is implemented using [node.js](https://nodejs.org), and rendering requires [chrome](https://www.chromium.org).

## Usage

By default `vzi` will produce a single, final, report document on `stdout`.
The pipe that gets executed by `vzi` (via `chrome`) defines what happens to the browser state as new events are received.

There are three ways to tell `vzi` how to execute its pipe:
 1. Pass the name of a file containing a handler as an argument
 2. Pass the script directly using the `-c, --cli` option
 3. Pass the name of a builtin module using the `-m, --module` option

```
cat events | vzi pipe.js
cat events | vzi -c '...'
cat events | vzi -m xyz/scatter
```

If the `-O, --no-output` option is given, output will be disabled.
If the `-o, --output` option is given, `vzi` will write its report state to the output path after every batch of events.
In this way, one can watch the output file for changes in order to observe the recent state of the pipeline (e.g. when running headless).
If neither `-o` nor `-O` are specified, only the final state is written to `stdout`.

```
cat events | vzi pipe.js -O
cat events | vzi pipe.js -o report.html
cat events | vzi pipe.js > report.html
```

One may also control the mechanism `vzi` uses for rendering the events using the `-p, --port` option.
If given, the port is assumed to speak the DevTools wire protocol (e.g. a browser with remote-debugging enabled).
If the `-p` option is not given, `vzi` will create its own browser for rendering.

```
cat events | vzi pipe.js
cat events | vzi pipe.js -p PORT
cat events | vzi pipe.js -p PORT > report.html
```

The `-H, --headless` option may be given to force `vzi` to create a headless browser.
This requires a browser capable of being run headlessly (NB: [Chrome Canary](https://www.google.com/chrome/browser/canary.html) at the time of this writing).

```
cat events | vzi pipe.js -H
```

Once the DevTools implementation is known, a page is opened and the events are sent via a layer on top of the Chrome debugging protocol.
Within this context, the user-defined pipe handler functions are executed.

## Pipes

There are two key interfaces that `vzi` provides.
One is the specification of how an output *report* gets produced.
The other is the environment in which user-defined functions are run, and the callbacks that are used.
We call the user-defined logic that executes in this environment the *pipe*.
