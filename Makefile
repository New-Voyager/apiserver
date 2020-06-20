.PHONY: build
build:
	./node_modules/.bin/tsc

.PHONY: install_deps
install_deps:
	npm install

.PHONY: test
test:
	yarn test
