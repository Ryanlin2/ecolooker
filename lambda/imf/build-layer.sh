#!/usr/bin/env bash
set -euo pipefail

LAYER_ZIP="imf-layer.zip"
PYTHON_VERSION="python3.11"
BUILD_DIR="build"
VENV_DIR=".venv-build"

echo "Cleaning old build artifacts..."
rm -rf "$BUILD_DIR" dist *.egg-info "$LAYER_ZIP" "$VENV_DIR"

echo "Creating isolated build environment..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

echo "Ensuring build tooling is installed..."
python -m pip install --upgrade pip setuptools wheel build

echo "Building Python wheel..."
python -m build --wheel

echo "Creating Lambda layer directory..."
mkdir -p "$BUILD_DIR/python/lib/$PYTHON_VERSION/site-packages"

echo "Installing package and dependencies into layer..."
python -m pip install \
  dist/*.whl \
  --target "$BUILD_DIR/python/lib/$PYTHON_VERSION/site-packages"

echo "Verifying installed package contents..."
find "$BUILD_DIR/python/lib/$PYTHON_VERSION/site-packages" -maxdepth 3 -type f | sort

echo "Testing import from layer path..."
PYTHONPATH="$BUILD_DIR/python/lib/$PYTHON_VERSION/site-packages" \
python -c "from imf.get_raw_imf_json import get_raw_imf_json; print('Import OK:', get_raw_imf_json)"

echo "Creating layer ZIP..."
cd "$BUILD_DIR"
zip -r "../$LAYER_ZIP" python
cd ..

echo "Verifying ZIP structure..."
unzip -l "$LAYER_ZIP" | head -100

echo "Done."
echo "Created: $LAYER_ZIP"