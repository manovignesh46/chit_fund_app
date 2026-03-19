#!/bin/bash

echo "Starting auto deploy..."

cd ~/code/my_projects/chit_fund_app || exit

while true
do
    echo "Checking for new changes..."

    git fetch origin

    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/dev-partner-track)

    if [ $LOCAL != $REMOTE ]; then
        echo "New update found. Deploying..."

        git pull origin dev-partner-track

        echo "Going inside microfinance-app..."
        cd microfinance-app || exit

        echo "Stopping containers..."
        docker compose down

        echo "Rebuilding containers..."
        docker compose build

        echo "Starting containers..."
        docker compose up -d

        echo "Deployment completed!"
        cd ..
    else
        echo "No changes found."
    fi

    sleep 60
done