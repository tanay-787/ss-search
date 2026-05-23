#!/bin/bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/home/tanay/opt/jdks/jdk17}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/home/tanay/.gradle}"
export PATH="$JAVA_HOME/bin:$PATH"

cd /devspace/projects/ss-search

pnpm android:dev
