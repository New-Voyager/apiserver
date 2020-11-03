#!/bin/sh

if ! { [ -d node_modules/gts ] && [ -d node_modules/prettier ]; }; then
  npx yarn install
fi
echo "Running prettier check"
status=0
npx prettier --config .prettierrc.js 'src/**/*.ts' --list-different || status=$?
npx prettier --config .prettierrc.js 'src/**/*.ts' --list-different --write >/dev/null
if [ ${status} -ne 0 ]; then
  echo "Prettier failed with status ${status}"
fi
exit ${status}
