.PHONY: check test install

check:
	deno check bin/vzi
	deno check lib/vzi.ts lib/www/*.ts

test:
	deno test

install:
	deno install -A -f bin/vzi
