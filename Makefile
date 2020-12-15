DEFAULT_DOCKER_NET := game
GCP_PROJECT_ID := voyager-01-285603
DO_REGISTRY := registry.digitalocean.com/voyager
GCP_REGISTRY := gcr.io/${GCP_PROJECT_ID}

POSTGRES_VERSION := 12.5

ifeq ($(OS), Windows_NT)
	BUILD_NO := $(file < build_number.txt)
else
	BUILD_NO := $(shell cat build_number.txt)
endif

.PHONY: build
build:
	npm install
	./node_modules/.bin/tsc

.PHONY: install_deps
install_deps:
	npx yarn install

.PHONY: clean
clean:
	rm -rf build

.PHONY: tests
tests:
	./run_system_tests.sh

.PHONY: unit-tests
unit-tests:
	yarn unit-tests

.PHONY: script-tests
script-tests:
	./run_script_tests.sh

.PHONY: setup-hook
setup-hook:
	ln -sf ../../lint.sh .git/hooks/pre-commit

.PHONY: lint
lint:
	./lint.sh

.PHONY: create-network
create-network:
	@docker network create $(DEFAULT_DOCKER_NET) 2>/dev/null || true

.PHONY: docker-build
docker-build:
	docker build -f docker/Dockerfile.apiserver . -t api-server

.PHONY: up
up: create-network
	docker-compose up

.PHONY: run-pg
run-pg:
	yarn run-pg

.PHONY: debug
debug:
	yarn watch-debug 
 
.PHONY: run-server
run-server:
	yarn run-pg &
	yarn watch-debug-nats
	echo "Running server...."

.PHONY: watch-debug
watch-debug:
	yarn watch-debug

.PHONY: run-server-nats
run-server-nats:
	yarn run-pg &
	yarn watch-debug-nats
	echo "Running server...."


.PHONY: publish
publish: export REGISTRY=${GCP_REGISTRY}
publish:  publish-common

.PHONY: do-publish
do-publish: export REGISTRY=${DO_REGISTRY}
do-publish: publish-common

.PHONY: publish-common
publish-common:
	# publish postgres so that we don't have to pull from the docker hub
	docker pull postgres:${POSTGRES_VERSION}
	docker tag postgres:${POSTGRES_VERSION} ${REGISTRY}/postgres:${POSTGRES_VERSION}
	docker push ${REGISTRY}/postgres:${POSTGRES_VERSION}
	# publish api server
	docker tag api-server ${REGISTRY}/api-server:$(BUILD_NO)
	docker tag api-server ${REGISTRY}/api-server:latest
	docker push ${REGISTRY}/api-server:$(BUILD_NO)
	docker push ${REGISTRY}/api-server:latest
