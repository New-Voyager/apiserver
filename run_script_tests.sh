#!/usr/bin/env bash

set -eo pipefail

PORT_NUMBER=9501

echo "Starting test server in background"
yarn test-server &
TEST_SERVER_PID=$!

echo "Test server PID: ${TEST_SERVER_PID}"

cleanup() {
    set +e
    echo "Stopping test server"
    kill ${TEST_SERVER_PID}
    fuser -k -TERM -n tcp ${PORT_NUMBER}
    set -e
}

# Make sure test server stops before scrip exit.
trap cleanup EXIT
echo "Waiting 5 seconds for the server to start..."
sleep 5
echo "Running script tests"
yarn script-tests
