#!/bin/bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/home/tanay/opt/jdks/jdk17}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/home/tanay/.gradle}"
export ANDROID_HOME="${ANDROID_HOME:-/devspace/android}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export ANDROID_NDK="${ANDROID_NDK:-$ANDROID_HOME/ndk/27.1.12297006}"
export CMAKE_HOME="${CMAKE_HOME:-$ANDROID_HOME/cmake/3.31.6}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$CMAKE_HOME/bin:$PATH"

cd /devspace/projects/ss-search

# The upstream build script expects the checkout under /tmp/react-native-siglip-build.
ln -sfn /devspace/projects/ss-search/vendor/react-native-siglip /tmp/react-native-siglip-build
mkdir -p /tmp/react-native-siglip-bin
ln -sfn "$(command -v python3.13 || command -v python3)" /tmp/react-native-siglip-bin/python3.11

cd vendor/react-native-siglip/.executorch-build/executorch

export PYTHON_EXECUTABLE="${PYTHON_EXECUTABLE:-$PWD/.venv/bin/python}"
./install_requirements.sh

build_android_native_library() {
  local android_abi="$1"
  local cmake_out="cmake-out-android-${android_abi}"
  local build_type="Release"
  local android_platform="android-26"

  cmake -S . -B "${cmake_out}" \
    -DFLATBUFFERS_FLATC_EXECUTABLE="/tmp/react-native-siglip-build/.executorch-build/executorch/third-party/flatbuffers/flatc" \
    -DCMAKE_INSTALL_PREFIX="${cmake_out}" \
    -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake" \
    -DPYTHON_EXECUTABLE="${PYTHON_EXECUTABLE}" \
    -DEXECUTORCH_BUILD_PRESET_FILE="${PWD}/tools/cmake/preset/android.cmake" \
    -DANDROID_ABI="${android_abi}" \
    -DANDROID_PLATFORM="${android_platform}" \
    -DEXECUTORCH_ENABLE_EVENT_TRACER=OFF \
    -DEXECUTORCH_BUILD_EXTENSION_LLM=ON \
    -DEXECUTORCH_BUILD_EXTENSION_LLM_RUNNER=ON \
    -DEXECUTORCH_BUILD_EXTENSION_TRAINING=ON \
    -DEXECUTORCH_BUILD_LLAMA_JNI=ON \
    -DEXECUTORCH_BUILD_NEURON=OFF \
    -DNEURON_BUFFER_ALLOCATOR_LIB= \
    -DEXECUTORCH_BUILD_QNN=OFF \
    -DQNN_SDK_ROOT= \
    -DEXECUTORCH_BUILD_VULKAN=OFF \
    -DSUPPORT_REGEX_LOOKAHEAD=ON \
    -DCMAKE_BUILD_TYPE="${build_type}"

  cmake --build "${cmake_out}" -j "$(nproc)" --target install --config "${build_type}"
}

mkdir -p cmake-out-android-so
build_android_native_library arm64-v8a
build_android_native_library x86_64

mkdir -p "cmake-out-android-so/arm64-v8a" "cmake-out-android-so/x86_64"
cp "cmake-out-android-arm64-v8a"/extension/android/*.so "cmake-out-android-so/arm64-v8a/libexecutorch.so"
cp "cmake-out-android-x86_64"/extension/android/*.so "cmake-out-android-so/x86_64/libexecutorch.so"

cd /devspace/projects/ss-search
node scripts/prepare-siglip-binaries.js
