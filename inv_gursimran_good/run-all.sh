#!/bin/bash

# Port configuration (if you want to force specific ports)
# Next.js will naturally increment if ports are taken, but explicitly setting them is safer.
# export PORT_BACKEND=3000
# export PORT_FRONTEND=3001
# export PORT_ADMIN=3002
# export PORT_INVENTORY=3003

# ANSI Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to kill all background processes started by this script
cleanup() {
    echo -e "\n${RED}Shutting down all processes...${NC}"
    # Kill all child processes of this script
    pkill -P $$
    exit 0
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   Cleaning up and Starting Services   ${NC}"
echo -e "${BLUE}=======================================${NC}"

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}Killing process on port $port (PID: $pid)...${NC}"
        kill -9 $pid
    fi
}

# Clear the ports first
kill_port 3000
kill_port 3001
kill_port 3002

echo -e "${GREEN}🚀 Starting Backend (NestJS) on port 3000...${NC}"
(cd backend && npm run start:dev) &

echo -e "${GREEN}🚀 Starting Frontend (Next.js) on port 3001...${NC}"
(cd frontend && PORT=3001 npm run dev) &

echo -e "${GREEN}🚀 Starting Admin Dashboard (Next.js) on port 3002...${NC}"
(cd admin && PORT=3002 npm run dev) &

echo -e "${YELLOW}---------------------------------------${NC}"
echo -e "${YELLOW} All services are starting up!         ${NC}"
echo -e "${YELLOW} Press Ctrl+C to stop all services.    ${NC}"
echo -e "${YELLOW}---------------------------------------${NC}"

# Wait for background processes to keep the script running
wait
