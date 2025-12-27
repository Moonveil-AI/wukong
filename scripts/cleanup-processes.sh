#!/bin/bash

# Wukong Process Cleanup Script
# Cleans up orphaned node/vite processes

set -e

FORCE=false
VITEST_ONLY=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -f|--force) FORCE=true ;;
        -v|--vitest-only) VITEST_ONLY=true ;;
        -h|--help)
            echo "Usage: $0 [-f|--force] [-v|--vitest-only] [-h|--help]"
            echo ""
            echo "Options:"
            echo "  -f, --force         Force kill all wukong processes without confirmation"
            echo "  -v, --vitest-only   Only kill vitest worker processes (safe, no dev servers)"
            echo "  -h, --help          Display this help message"
            echo ""
            echo "Description:"
            echo "  This script cleans up orphaned node/vite/vitest processes."
            echo "  Use --vitest-only for safe cleanup after tests."
            exit 0
            ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
    shift
done

if [ "$VITEST_ONLY" = true ]; then
    echo "🔍 Searching for vitest worker processes..."
else
    echo "🔍 Searching for wukong-related processes..."
fi
echo ""

# Find processes based on mode
if [ "$VITEST_ONLY" = true ]; then
    # Only vitest workers - safe for auto-cleanup
    WUKONG_PROCESSES=$(ps aux | grep -E "node.*\(vitest" | grep -v grep | grep -v "$0" || true)
else
    # All wukong processes - requires confirmation
    WUKONG_PROCESSES=$(ps aux | grep -E "node.*wukong|vite|vitest" | grep -v grep | grep -v "$0" || true)
fi

if [ -z "$WUKONG_PROCESSES" ]; then
    echo "✅ No orphaned processes found"
    exit 0
fi

echo "Found the following processes:"
echo "----------------------------------------"
echo "$WUKONG_PROCESSES"
echo "----------------------------------------"
echo ""

# Extract PIDs
PIDS=$(echo "$WUKONG_PROCESSES" | awk '{print $2}')
PID_COUNT=$(echo "$PIDS" | wc -l | tr -d ' ')

echo "Total: $PID_COUNT process(es)"
echo ""

# Check if we should kill them
# Auto-confirm for vitest-only mode (safe)
if [ "$VITEST_ONLY" = true ]; then
    FORCE=true
fi

if [ "$FORCE" = false ]; then
    read -p "Do you want to kill these processes? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled"
        exit 0
    fi
fi

# Kill the processes
echo ""
echo "🔪 Killing processes..."

for PID in $PIDS; do
    # Check if process still exists
    if ps -p $PID > /dev/null 2>&1; then
        echo "  Killing PID $PID..."
        kill $PID 2>/dev/null || true
    fi
done

# Wait a bit and check if any processes are still running
sleep 1

if [ "$VITEST_ONLY" = true ]; then
    REMAINING=$(ps aux | grep -E "node.*\(vitest" | grep -v grep | grep -v "$0" || true)
else
    REMAINING=$(ps aux | grep -E "node.*wukong|vite|vitest" | grep -v grep | grep -v "$0" || true)
fi

if [ -n "$REMAINING" ]; then
    echo ""
    echo "⚠️  Some processes are still running, force killing..."
    
    REMAINING_PIDS=$(echo "$REMAINING" | awk '{print $2}')
    for PID in $REMAINING_PIDS; do
        if ps -p $PID > /dev/null 2>&1; then
            echo "  Force killing PID $PID..."
            kill -9 $PID 2>/dev/null || true
        fi
    done
fi

echo ""
echo "✅ Cleanup completed!"

# Final check
if [ "$VITEST_ONLY" = true ]; then
    FINAL_CHECK=$(ps aux | grep -E "node.*\(vitest" | grep -v grep | grep -v "$0" || true)
else
    FINAL_CHECK=$(ps aux | grep -E "node.*wukong|vite|vitest" | grep -v grep | grep -v "$0" || true)
fi

if [ -n "$FINAL_CHECK" ]; then
    echo ""
    echo "⚠️  Warning: Some processes are still running:"
    echo "$FINAL_CHECK"
    echo ""
    echo "You can try to kill them manually, or use: pkill -9 -f wukong"
    exit 1
fi

