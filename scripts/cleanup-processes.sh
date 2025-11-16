#!/bin/bash

# Wukong Process Cleanup Script
# Cleans up orphaned node/vite processes

set -e

FORCE=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -f|--force) FORCE=true ;;
        -h|--help)
            echo "Usage: $0 [-f|--force] [-h|--help]"
            echo ""
            echo "Options:"
            echo "  -f, --force    Force kill all wukong processes without confirmation"
            echo "  -h, --help     Display this help message"
            echo ""
            echo "Description:"
            echo "  This script cleans up orphaned node/vite processes."
            echo "  It searches for node processes in the wukong directory."
            exit 0
            ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
    shift
done

echo "🔍 Searching for wukong-related processes..."
echo ""

# Find all node processes related to wukong
WUKONG_PROCESSES=$(ps aux | grep -E "node.*wukong|vite" | grep -v grep | grep -v "$0" || true)

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

REMAINING=$(ps aux | grep -E "node.*wukong|vite" | grep -v grep | grep -v "$0" || true)

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
FINAL_CHECK=$(ps aux | grep -E "node.*wukong|vite" | grep -v grep | grep -v "$0" || true)

if [ -n "$FINAL_CHECK" ]; then
    echo ""
    echo "⚠️  Warning: Some processes are still running:"
    echo "$FINAL_CHECK"
    echo ""
    echo "You can try to kill them manually, or use: pkill -9 -f wukong"
    exit 1
fi

