.PHONY: build
build:
	./node_modules/.bin/tsc

.PHONY: install_deps
install_deps:
	yarn install

.PHONY: clean
clean:
	rm -rf build

.PHONY: test
test:
	yarn test
