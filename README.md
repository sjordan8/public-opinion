# Public Opinion
Public Opinion is a Node.js web app which utilizes the Twitter API to gather data about Twitter trends which is stored inside of a MongoDB database.

## How it works

The Node.js server hits the Twitter API and pull tweets from Twitter's trending category and places the JSON data inside of a mongoDB database. The server then runs the content of those tweets through Google's Natural Language Processor. Google's NLP decides whether the public opinion of the trend is positive or negative. After Google's NLP finishes analyzing the data it returns the sentiment analysis to the Node.js server. The newly analzyed data is placed in a mongoDB database.

## Setup

First you need to create a twitter developer account. Then you need to create an app and set the four environment variables it provides you with under the `Keys and Tokens` section that go as following:

```
CONSUMER_KEY
CONSUMER_SECRET
ACCESS_SECRET
ACCESS_SECRET_TOKEN
```

Now you're ready to run `public-opinion` using docker-compose

## Quickstart

This assumes you have docker-compose installed on your machine
```
git clone https://github.com/sjordan8/public-opinion.git
cd public-opinion
docker-compose up
```

The application should be running on port 8080
