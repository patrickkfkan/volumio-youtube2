#!/bin/sh

ARCH="$(dpkg --print-architecture)"

# Deno only supports x64 (amd64) and aarch64 (arm64)
if [ "${ARCH}" = "amd64" ] || [ "${ARCH}" = "arm64" ]; then
    echo "Installing Deno..."
    pushd /data/plugins/music_service/ytmusic > /dev/null
    npm i --omit=dev deno@"^2.5.4"
    popd > /dev/null
else
    echo "Skipping Deno installation - not supported on ${ARCH}"
fi

echo "YouTube2 plugin installed"
echo "plugininstallend"
