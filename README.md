# Public Opinion
Public Opinion is a Node.js web app which utilizes the Twitter API to gather data about Twitter trends which is stored inside of a MongoDB database.

## How it works

The Node.js server hits the Twitter API and pull tweets from Twitter's trending category and places the JSON data inside of a mongoDB database. The server then runs the content of those tweets through Google's Natural Language Processor. Google's NLP decides whether the public opinion of the trend is positive or negative. After Google's NLP finishes analyzing the data it returns the sentiment analysis to the Node.js server. The newly analzyed data is placed in a mongoDB database.

## How to run it

First you need to create a twitter developer account. Then you need to create an app and set the four environment variables it provides you with under the `Keys and Tokens` section that go as following:

```
CONSUMER_KEY
CONSUMER_SECRET
ACCESS_SECRET
ACCESS_SECRET_TOKEN
```

After you have your Twitter Developer account keys set up you need to set the `MONGODB_URL` environment variable for connection to a Mongo database.

Now you're ready to run `public-opinion`

```
git clone https://github.com/sjordan8/public-opinion.git
cd public-opinion
npm install
npm run start
```

