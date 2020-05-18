# Public Opinion
Public Opinion is a Node.js web app that uses the d3.js data visualization tool which utilizes the Twitter API to gather data about Twitter trends which is stored inside of a MongoDB database.

## How it works

The Node.js server hits the Twitter API and pull tweets from Twitter's trending category and places the JSON data inside of a mongoDB database. The server then runs the content of those tweets through Google's Natural Language Processor. Google's NLP decides whether the public opinion of the trend is positive or negative. After Google's NLP finishes analyzing the data it returns the sentiment analysis to the Node.js server. The newly analzyed data is placed in a mongoDB database and is used to create a graph of the trend

## How to run it
```
git clone https://github.com/sjordan8/public-opinion.git
cd public-opinion
npm install
npm run start
```

