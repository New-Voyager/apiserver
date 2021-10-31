#!/usr/bin/env bash

set -eo pipefail

# PORT_NUMBER=9501

# echo "Starting test server in background"
# npm run int-server &
# TEST_SERVER_PID=$!

# echo "Test server PID: ${TEST_SERVER_PID}"

# cleanup() {
#     set +e
#     echo "Stopping test server"
#     kill ${TEST_SERVER_PID}
#     fuser -k -TERM -n tcp ${PORT_NUMBER}
#     set -e
# }

# # Make sure test server stops before scrip exit.
# trap cleanup EXIT

echo "Running tests"
npm run int-test
