#!/bin/bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/home/tanay/opt/jdks/jdk17}"
export PATH="$JAVA_HOME/bin:$PATH"

cd /devspace/projects/ss-search

pnpm exec eas build --local --platform android --profile development
