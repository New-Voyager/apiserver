#!/bin/sh

set -e

python3 -m venv myvenv
source myvenv/bin/activate
pip install gql 
pip install aiohttp
pip install requests
