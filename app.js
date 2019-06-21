const express = require('express');
const fs = require('fs');
const path = require('path');
const language = require('@google-cloud/language');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Twit = require('twit');
const keys = require('./config/keys');

const City = require('./models/city');
const Tweet = require('./models/tweet');

mongoose.connect('mongodb://localhost/opinion');

const db = mongoose.connection;

const client = new language.LanguageServiceClient();

db.once('open', function() {
    console.log('Server connected to mongoDB');
});

db.on('error', function(err) {
    console.log(err);
});

const T = new Twit({
  consumer_key:         keys.consumer_key,
  consumer_secret:      keys.consumer_secret,
  access_token:         keys.access_token,
  access_token_secret:  keys.access_token_secret,
})





const app = express();

app.use(express.static('static'));

// Pug middleware
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Body Parse Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function(req, res) {
    City.find({}, function(err, cities){
        if(err){
            console.log(err);
        } else {
            res.render('index', {
                cities: cities
            });
        }
    });
});

app.get('/add', function(req, res) {
    res.render('add');
    return;
});



app.get('/us', function(req, res) {
    res.sendFile('/static/us.json', { root: __dirname });
    return;
});

//Trends Function
app.get('/get_cities', function(req, res) {
    T.get('trends/available', function (err, data, response)
    {
        const trends = data;
        for (let i = 0; i < trends.length; i++)
        {
            let trend = trends[i];
            if (trend["country"] == "United States")
            {
                let place = trend["placeType"];
                if (place["name"] == "Town")
                {
                    City.find({ name: trend["name"] }, function(err, cities){
                        if(err){
                            console.log(err);
                        } else {
                            let city = new City();
                            city.name = trend["name"];
                            city.woeid = trend["woeid"];

                            city.save(function(err) {
                                if(err) {
                                    console.log(err);
                                } 
                            });
                        }
                    });
                }
            }
        }
        console.log("Written Cities!");
        res.redirect('back');
    })
    return;
});

app.get('/get_coordinates', function(req, res) {

    City.find({ centroid: [] }, function (err, cities) {
        for (let i = 0; i < cities.length; i++)
        {
            let city = cities[i];
            T.get('geo/search', { query: city["name"], granularity: "city", max_results: "1" }, function (err, data, response)
            {
                if (err)
                {
                    console.log(err);
                    return;
                }
                else
                {
                    let obj = data.result.places[0];
                    city.centroid = obj["centroid"];
                    city.save(function(err) {
                        if (err)
                            console.log(err);
                    });
                    console.log(city["centroid"]);
                }
            })
        }
    });
    res.redirect('back');
    return;
});

app.get('/get_trends/:woeid', function(req, res) {
    City.find({ woeid: req.params.woeid }, function (err, cities) { 
        let city = cities[0];
        T.get('trends/place', { id: req.params.woeid }, function (err, data, response)
        {
            let obj = data[0];
            let topTrends = obj["trends"];
            let trends = topTrends.slice(0,10);

            city.trends = trends;
            city.save(function(err) {
                if (err)
                    console.log(err);
            });
            res.redirect('back');

        })
    });
    return;
});

app.get('/get_tweets/:woeid/:query', function(req, res) {
    City.find({ woeid: req.params.woeid }, function (err, cities) {
        let city = cities[0];
        let latitude = city.centroid[1];
        let longitude = city.centroid[0];
        let r = "5mi";
        let geo = [ latitude, longitude, r ];
        T.get('search/tweets', { q: req.params.query, geocode: geo, count: "100" } , function (err, data, response)
        {
            if(err) {
                console.log(err);
            }
            else {
                let tweets = data.statuses;
                for( let i = 0; i < tweets.length; i++)
                {
                    let t = tweets[i];
                    Tweet.find({ id: t.id }, function (err, tweets) {
                        if (tweets.length == 0) {
                            let tweet = new Tweet();
                            tweet.created_at = t.created_at;
                            tweet.text = t.text;
                            tweet.id = t.id;
                            tweet.woeid = req.params.woeid;
                            tweet.trend = req.params.query;
                            tweet.save(function(err) {
                                if(err) {
                                    console.log(err);
                                }
                            });
                        }
                    });
                }
                console.log("Added around " + tweets.length + " tweets to the DB");
                res.redirect('back');
            }
        })     
    });
    return;
});

app.get('/analyze_tweets', function(req, res) {
    Tweet.find({ sentiment: null }, function (err, tweets) {
        for(let i = 0; i < tweets.length; i++)
        {
            let tweet = tweets[i];
            let text = tweet.text;
            const document = {
                content: text,
                type: 'PLAIN_TEXT',
                language: 'en',
            };
        
            // Detects the sentiment of the text
            client
            .analyzeSentiment({document: document})
            .then(results => {
                const sentiment = results[0].documentSentiment;
                tweet.sentiment = sentiment.score; 
                tweet.save(function (err) {
                    if(err) {
                        console.log(err);
                    }
                });
            })
            .catch(err => {
                console.error('ERROR:', err);
            });
        }
    });
    
    res.redirect('back');
    return;
});

app.get('/create_graph/:woeid/:query', function(req,res) {
    Tweet.find({ woeid: req.params.woeid, trend: req.params.query, sentiment: { $exists: true }  }, function (err, tweets) {
        let scores = [];
        for (let i = 0; i < tweets.length; i++)
        {
            let tweet = tweets[i];
            scores.push(tweet["sentiment"]);
        }
        console.log(scores);
        res.redirect('back');

    });
    return;
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);

