DEFAULT_DOCKER_NET := game
GCP_PROJECT_ID := voyager-01-285603
DO_REGISTRY := registry.digitalocean.com/voyager
GCP_REGISTRY := gcr.io/$(GCP_PROJECT_ID)

POSTGRES_VERSION := 12.5
NATS_VERSION := 2.1.7-alpine3.11
REDIS_VERSION := 6.0.9

DOCKER_BUILDKIT ?= 1

GCR_REGISTRY := gcr.io/voyager-01-285603
DO_REGISTRY := registry.digitalocean.com/voyager
REGISTRY := $(GCP_REGISTRY)

API_SERVER_IMAGE := $(REGISTRY)/api-server:0.6.29
GAME_SERVER_IMAGE := $(REGISTRY)/game-server:0.7.3
BOTRUNNER_IMAGE := $(REGISTRY)/botrunner:0.7.1
TIMER_IMAGE := $(REGISTRY)/timer:0.5.6

NATS_SERVER_IMAGE := $(REGISTRY)/nats:$(NATS_VERSION)
REDIS_IMAGE := $(REGISTRY)/redis:$(REDIS_VERSION)
POSTGRES_IMAGE := $(REGISTRY)/postgres:$(POSTGRES_VERSION)

LOCAL_IP := $(POKER_LOCAL_IP)
API_SERVER_URL := http://$(LOCAL_IP):9501
LOCAL_NATS_URL := nats://$(LOCAL_IP):4222
LOCAL_POSTGRES_HOST := $(LOCAL_IP)

COMPOSE_PROJECT_NAME := apiserver
COMPOSE := docker-compose -p $(COMPOSE_PROJECT_NAME)
COMPOSE_REDIS := docker-compose -p $(COMPOSE_PROJECT_NAME) -f docker-compose-redis.yaml
COMPOSE_NATS := docker-compose -p $(COMPOSE_PROJECT_NAME) -f docker-compose-nats.yaml
COMPOSE_PG := docker-compose -p $(COMPOSE_PROJECT_NAME) -f docker-compose-pg.yaml

ifeq ($(OS), Windows_NT)
	BUILD_NO := $(file < build_number.txt)
else
	BUILD_NO := $(shell cat build_number.txt)
endif

.PHONY: build
build: install_deps
	npx yarn compile

.PHONY: install_deps
install_deps:
	npm install

.PHONY: clean
clean:
	rm -rf build
	rm -rf node_modules

.PHONY: tests
tests: run-redis run-nats run-pg
	./run_system_tests.sh

.PHONY: unit-tests
unit-tests:
	npx yarn unit-tests

.PHONY: tests-local
tests-local: export NATS_URL=http://localhost:4222
tests-local: run-redis run-nats
	./run_system_tests.sh


.PHONY: script-tests
script-tests: run-redis
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

.PHONY: docker-build-test
docker-build-test:
	DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) docker build -f docker/Dockerfile.test . -t api-server-test

.PHONY: up
up: create-network
	$(COMPOSE) up

.PHONY: debug
debug: watch-localhost-debug

.PHONY: watch-localhost-debug
watch-localhost-debug: export NATS_URL=$(LOCAL_NATS_URL)
watch-localhost-debug: export POSTGRES_HOST=$(LOCAL_POSTGRES_HOST)
watch-localhost-debug:
	npx yarn watch-localhost-debug

.PHONY: login
login: gcp-login

.PHONY: do-login
do-login:
	docker login --username 69bf6de23225d8abd358d7c5c2dac07d64a7f6c0bd97d5a5a974847269f99455 --password 69bf6de23225d8abd358d7c5c2dac07d64a7f6c0bd97d5a5a974847269f99455 registry.digitalocean.com

.PHONY: gcp-login
gcp-login:
	@cat gcp_dev_image_push.json | docker login -u _json_key --password-stdin https://gcr.io

.PHONY: publish
publish: gcp-publish

.PHONY: do-publish
do-publish: export REGISTRY=$(DO_REGISTRY)
do-publish: do-login publish-apiserver

.PHONY: do-publish-all
do-publish-all: export REGISTRY=$(DO_REGISTRY)
do-publish-all: do-login publish-all

.PHONY: gcp-publish
gcp-publish: export REGISTRY=$(GCP_REGISTRY)
gcp-publish: gcp-login publish-apiserver

.PHONY: gcp-publish-all
gcp-publish-all: export REGISTRY=$(GCP_REGISTRY)
gcp-publish-all: gcp-login publish-all

.PHONY: publish-all
publish-all: publish-apiserver publish-3rdparty

.PHONY: publish-apiserver
publish-apiserver:
	docker tag api-server $(REGISTRY)/api-server:$(BUILD_NO)
	docker tag api-server $(REGISTRY)/api-server:latest
	docker push $(REGISTRY)/api-server:$(BUILD_NO)
	docker push $(REGISTRY)/api-server:latest

.PHONY: publish-3rdparty
publish-3rdparty:
	# publish 3rd-party images so that we don't have to pull from the docker hub
	docker pull postgres:$(POSTGRES_VERSION)
	docker tag postgres:$(POSTGRES_VERSION) $(REGISTRY)/postgres:$(POSTGRES_VERSION)
	docker push $(REGISTRY)/postgres:$(POSTGRES_VERSION)

.PHONY: generate-env
generate-env:
	> .env && \
	echo "NATS_SERVER_IMAGE=$(NATS_SERVER_IMAGE)" >> .env && \
	echo "REDIS_IMAGE=$(REDIS_IMAGE)" >> .env && \
	echo "POSTGRES_IMAGE=$(POSTGRES_IMAGE)" >> .env && \
	echo "PROJECT_ROOT=$(PWD)" >> .env

.PHONY: run-pg
run-pg: stop-pg generate-env
	TEST_DOCKER_NET=$(DEFAULT_DOCKER_NET) $(COMPOSE_PG) up -d

.PHONY: stop-pg
stop-pg:
	TEST_DOCKER_NET=$(DEFAULT_DOCKER_NET) $(COMPOSE_PG) down

run-redis: stop-redis generate-env
	TEST_DOCKER_NET=$(DEFAULT_DOCKER_NET) $(COMPOSE_REDIS) up -d

.PHONY: stop-redis
stop-redis:
	TEST_DOCKER_NET=$(DEFAULT_DOCKER_NET) $(COMPOSE_REDIS) down

.PHONY: run-nats
run-nats: stop-nats generate-env
	TEST_DOCKER_NET=$(DEFAULT_DOCKER_NET) $(COMPOSE_NATS) up -d

.PHONY: stop-nats
stop-nats:
	TEST_DOCKER_NET=$(DEFAULT_DOCKER_NET) $(COMPOSE_NATS) down

.PHONY: docker-unit-tests
docker-unit-tests: create-network
	docker run -t --rm \
		--name api-server \
		--network $(DEFAULT_DOCKER_NET) \
		-e REDIS_HOST=redis \
		-e REDIS_PORT=6379 \
		-e REDIS_DB=0 \
		api-server-test sh -c "yarn unit-tests"


.PHONY: docker-script-tests
docker-script-tests: create-network run-redis
	docker run -t --rm \
		--name api-server-test \
		--network $(DEFAULT_DOCKER_NET) \
		-e REDIS_HOST=redis \
		-e REDIS_PORT=6379 \
		-e REDIS_DB=0 \
		api-server-test sh -c "sh ./run_script_tests.sh"

.PHONY: docker-tests
docker-tests: create-network run-redis run-nats run-pg
	docker run -t --rm \
		--name api-server-test \
		--network $(DEFAULT_DOCKER_NET) \
		-e REDIS_HOST=redis \
		-e REDIS_PORT=6379 \
		-e REDIS_DB=0 \
		-e NATS_URL=nats://nats:4222 \
		-e POSTGRES_HOST=mydb \
		api-server-test sh -c "sh ./run_system_tests.sh"

.PHONY: run-all
run-all: create-network run-pg run-nats run-redis
	echo 'All services are running'

.PHONY: stop-all
stop-all: stop-pg stop-nats stop-redis
	echo 'All services are stopped'

.PHONY: stack-generate-env
stack-generate-env:
	cd docker && \
		> .env && \
		echo "API_SERVER_URL=$(API_SERVER_URL)" >> .env && \
		echo "API_SERVER_IMAGE=$(API_SERVER_IMAGE)" >> .env && \
		echo "GAME_SERVER_IMAGE=$(GAME_SERVER_IMAGE)" >> .env && \
		echo "NATS_SERVER_IMAGE=$(NATS_SERVER_IMAGE)" >> .env && \
		echo "REDIS_IMAGE=$(REDIS_IMAGE)" >> .env && \
		echo "POSTGRES_IMAGE=$(POSTGRES_IMAGE)" >> .env && \
		echo "BOTRUNNER_IMAGE=$(BOTRUNNER_IMAGE)" >> .env && \
		echo "TIMER_IMAGE=$(TIMER_IMAGE)" >> .env && \
		echo "PROJECT_ROOT=$(PWD)" >> .env

.PHONY: stack-up
stack-up: create-network login stack-generate-env
		cd docker && $(COMPOSE) up -d

.PHONY: stack-logs
stack-logs:
	cd docker && $(COMPOSE) logs -f

.PHONY: stack-down
stack-down: create-network
	cd docker && $(COMPOSE) down --remove-orphans

#
# Usage:
#
# BOTRUNNER_SCRIPT=botrunner_scripts/river-action-3-bots.yaml make botrunner
# BOTRUNNER_SCRIPT=botrunner_scripts/river-action-2-bots-1-human.yaml make botrunner
#
.PHONY: botrunner
botrunner:
	@DOCKER_NET=$(DEFAULT_DOCKER_NET) \
		BOTRUNNER_IMAGE=$(BOTRUNNER_IMAGE) \
		BOTRUNNER_SCRIPT=$(BOTRUNNER_SCRIPT) \
		./botrunner.sh

.PHONY: simple-game reset-db
simple-game:
	BOTRUNNER_SCRIPT=botrunner_scripts/river-action-3-bots.yaml make botrunner

reset-db:
	curl -X POST -v  -H 'Content-Type: application/json' -d '{"query":"mutation {resetDB}"}' http://localhost:9501/graphql

.PHONY: clean-ci
clean-ci: stop-nats stop-redis stop-pg
