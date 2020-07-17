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
	./run_system_tests.sh

.PHONY: unit_test
unit_test:
	yarn unit-tests
