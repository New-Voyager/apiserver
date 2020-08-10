DEFAULT_DOCKER_NET := game

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


.PHONY: script_tests
script_tests:
	./run_script_tests.sh

.PHONY: create-network
create-network:
	@docker network create $(DEFAULT_DOCKER_NET) 2>/dev/null || true

.PHONY: up
up: create-network
	docker-compose up
