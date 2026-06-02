#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning old build artifacts..."
rm -rf build dist *.egg-info imf-layer.zip .venv-build

echo "Creating isolated build environment..."
python3 -m venv .venv-build
source .venv-build/bin/activate

echo "Ensuring build tooling is installed..."
python -m pip install --upgrade pip setuptools wheel build

echo "Building Python wheel..."
python -m build --wheel

echo "Creating Lambda layer directory..."
mkdir -p build/python/lib/python3.11/site-packages

echo "Installing package and dependencies into layer..."
python -m pip install \
  dist/*.whl \
  --target build/python/lib/python3.11/site-packages

echo "Creating layer ZIP..."
cd build
zip -r ../imf-layer.zip python
cd ..

echo "Done."
echo "Created: imf-layer.zip"