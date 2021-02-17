DEFAULT_DOCKER_NET := game
GCP_PROJECT_ID := voyager-01-285603
DO_REGISTRY := registry.digitalocean.com/voyager
GCP_REGISTRY := gcr.io/${GCP_PROJECT_ID}

POSTGRES_VERSION := 12.5

DOCKER_BUILDKIT ?= 1

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
	yarn run-redis &
	./run_system_tests.sh

.PHONY: unit-tests
unit-tests:
	yarn run-redis &
	yarn unit-tests

.PHONY: script-tests
script-tests:
	yarn run-redis &
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
	DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) docker build -f docker/Dockerfile.apiserver . -t api-server

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
publish: do-publish

.PHONY: do-login
do-login:
	docker login --username 69bf6de23225d8abd358d7c5c2dac07d64a7f6c0bd97d5a5a974847269f99455 --password 69bf6de23225d8abd358d7c5c2dac07d64a7f6c0bd97d5a5a974847269f99455 registry.digitalocean.com

.PHONY: do-publish
do-publish: export REGISTRY=${DO_REGISTRY}
do-publish: do-login publish-apiserver

.PHONY: do-publish-all
do-publish-all: export REGISTRY=${DO_REGISTRY}
do-publish-all: do-login publish-all

.PHONY: gcp-publish
gcp-publish: export REGISTRY=${GCP_REGISTRY}
gcp-publish: publish-apiserver

.PHONY: gcp-publish-all
gcp-publish-all: export REGISTRY=${GCP_REGISTRY}
gcp-publish-all: publish-all

.PHONY: publish-all
publish-all: publish-apiserver publish-3rdparty

.PHONY: publish-apiserver
publish-apiserver:
	docker tag api-server ${REGISTRY}/api-server:$(BUILD_NO)
	docker tag api-server ${REGISTRY}/api-server:latest
	docker push ${REGISTRY}/api-server:$(BUILD_NO)
	docker push ${REGISTRY}/api-server:latest

.PHONY: publish-3rdparty
publish-3rdparty:
	# publish 3rd-party images so that we don't have to pull from the docker hub
	docker pull postgres:${POSTGRES_VERSION}
	docker tag postgres:${POSTGRES_VERSION} ${REGISTRY}/postgres:${POSTGRES_VERSION}
	docker push ${REGISTRY}/postgres:${POSTGRES_VERSION}
