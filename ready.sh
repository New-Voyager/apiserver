#!/usr/bin/env bash

set -e


if [ "$#" == 0 ]; then
    echo "Insufficient arguments."
    exit 1
fi

urls=()
for i in "$@"; do
    case "$i" in
        --readiness)
            urls+=("http://localhost:9502/internal/ready")
            ;;
        --liveness)
            urls+=("http://localhost:9502/internal/alive")
            ;;
        *)
            echo "Invalid argument."
            exit 1
    esac
done

for url in "${urls[@]}"; do
    http_status=$(curl -s --max-time 2 --show-error -o /dev/null -w "%{http_code}" "${url}")
    command_status=$?
    if [ ${command_status} -ne 0 ]
    then
        echo "Curl returned ${command_status} for ${url}"
        exit ${command_status}
    fi

    if [ "${http_status}" != 200 ]
    then
        echo "${url} returned http status ${http_status}"
        exit 1
    fi
done
