.PHONY: build clean install

build:
	npm -s install

clean:
	rm -rf node_modules

install:
	npm link
