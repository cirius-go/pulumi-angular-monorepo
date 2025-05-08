#!/usr/bin/env bash

cd ./workspace || exit

# Check if application name and stage are provided
if [ "$1" = "" ] || [ "$2" = "" ]; then
  echo "Error: Application name or stage not provided."
  echo "Usage: $0 <stage> <application-name>"
  exit 1
fi

STAGE=$1
APP_NAME=$2
BUILD_DIR="../deployment/aws/.build/$STAGE"

# Clean up the previous build directory if it exists
if [ -d "$BUILD_DIR/$APP_NAME" ]; then
  rm -rf "${BUILD_DIR:?}/$APP_NAME"
fi

# Create the build directory if it doesn't exist
mkdir -p "$BUILD_DIR"

# Run the Nx build command for the specified application and check its exit status
if npx nx build "$APP_NAME" --configuration="$STAGE" --output-path="$BUILD_DIR/$APP_NAME" --skipNxCache; then
  echo "Build successful. Output is in $BUILD_DIR/$APP_NAME"
else
  echo "Build failed."
  exit 1
fi
