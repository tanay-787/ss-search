#!/bin/bash
# EAS Local Android Build Script for Termux
# This script builds the app locally using EAS Build with Android platform

# Set Java Home to use OpenJDK 17 installed via pkg
export JAVA_HOME=$PREFIX/lib/jvm/java-17-openjdk

# Add Java bin directory to PATH so gradle can find java command
export PATH=$JAVA_HOME/bin:$PATH

# Set Android SDK location (installed via termux-sdk)
# Termux installs the SDK to $PREFIX/opt/android-sdk
export ANDROID_HOME=$PREFIX/opt/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
# Ensure platform-tools and cmdline-tools are on PATH
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH

# Skip automatic fingerprint calculation (slower, optional for local builds)
# Remove this flag if you want full fingerprint verification
export EAS_SKIP_AUTO_FINGERPRINT=1

# Change to project directory
cd /data/data/com.termux/files/home/projects/ss-search

# Run EAS build for Android
# --local              : Build on this machine instead of EAS servers
# --platform android   : Build for Android (alternative: ios)
# --profile development    : Use the "development" build profile from eas.json
eas build --local --platform android --profile development
