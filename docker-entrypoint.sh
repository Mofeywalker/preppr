#!/bin/sh
set -e

# Fix ownership of the mounted data directory so SQLite can read/write and create WAL files
if [ -d "/data" ]; then
    mkdir -p /data/uploads
    chown -R nextjs:nodejs /data 2>/dev/null || chmod -R 777 /data 2>/dev/null || true
fi

# If running as root, drop privileges to the unprivileged nextjs user
if [ "$(id -u)" = '0' ]; then
    exec su-exec nextjs "$@"
fi

exec "$@"
