#!/bin/bash

# Health check script for Security Data Hub

set -e

# Check if the application is responding
if curl -f -s http://localhost:3000/api/auth/session > /dev/null; then
    echo "✅ Application is healthy"
    exit 0
else
    echo "❌ Application is not responding"
    exit 1
fi