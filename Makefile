DEFAULT_DOCKER_NET := game
GCP_PROJECT_ID := voyager-01-285603
BUILD_NO := $(shell cat build_number.txt)

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

.PHONY: docker-build
docker-build:
	docker build -f docker/Dockerfile.apiserver . -t api-server

.PHONY: up
up: create-network
	docker-compose up

.PHONY: publish
publish:
	# publish api server
	docker tag api-server gcr.io/${GCP_PROJECT_ID}/api-server:$(BUILD_NO)
	docker tag api-server gcr.io/${GCP_PROJECT_ID}/api-server:latest
	docker push gcr.io/${GCP_PROJECT_ID}/api-server:$(BUILD_NO)
	docker push gcr.io/${GCP_PROJECT_ID}/api-server:latest
