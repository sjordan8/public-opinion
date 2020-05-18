const express = require('express');
const fs = require('fs');
const path = require('path');
const language = require('@google-cloud/language');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Twit = require('twit');
require('dotenv').config();


const City = require('./models/city');
const Tweet = require('./models/tweet');

const mongoURL = process.env.MONGODB_URL || 'mongodb://localhost';
// Example URL for localhost: (mongodb://localhost/opinion)
mongoose.connect(mongoURL, { useNewUrlParser: true });
const db = mongoose.connection;

const client = new language.LanguageServiceClient();

db.once('open', () => {
    console.log('Server connected to mongoDB');
});

db.on('error', (err) => {
    console.log(err);
});

const T = new Twit({
    consumer_key:         process.env.CONSUMER_KEY,
    consumer_secret:      process.env.CONSUMER_SECRET,
    access_token:         process.env.ACCESS_TOKEN,
    access_token_secret:  process.env.ACCESS_TOKEN_SECRET,
})

const app = express();

app.use(express.static('static'));

// Pug middleware
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Body Parse Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    City.find({}, (err, cities) => {
        if (err) {
            console.log(err);
        } else {
            res.render('index', {
                cities: cities
            });
        }
    });
});

//Trends Function
app.get('/get_cities', (req, res) => {
    T.get('trends/available', (err, data, response) => {
        for (let i = 0; i < data.length; i++) {
            let trend = data[i];
            if (trend["country"] == "United States") {
                let placeType = trend["placeType"];
                if (placeType["name"] == "Town") {
                    City.find({ name: trend["name"] }, (err, cities) => {
                        if (err) {
                            console.log(err);
                        } else {
                            if (cities.length == 0) {
                                let city = new City();
                                city.name = trend["name"];
                                city.woeid = trend["woeid"];
                                city.save((err) => {
                                    if (err) {
                                        console.log(err);
                                    } 
                                });
                            }
                            console.log(cities.length);
                        }
                    });
                }
            }
        }
        console.log("Written Cities!");
        res.redirect('back');
    });
    return;
});

app.get('/get_coordinates', (req, res) => {
    City.find({ centroid: [] }, (err, cities) => {
        for (let i = 0; i < cities.length; i++) {
            let city = cities[i];
            T.get('geo/search', { query: city["name"], granularity: "city", max_results: "1" }, (err, data, response) => {
                if (err) {
                    console.log(err);
                    return;
                } else {
                    let obj = data.result.places[0];
                    city.centroid = obj["centroid"];
                    city.save((err) => {
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

app.get('/get_trends/:woeid', (req, res) => {
    City.find({ woeid: req.params.woeid }, (err, cities) => { 
        let city = cities[0];
        T.get('trends/place', { id: req.params.woeid }, (err, data, response) => {
            let obj = data[0];
            let topTrends = obj["trends"];
            let trends = topTrends.slice(0,10);

            city.trends = trends;
            city.save((err) => {
                if (err)
                    console.log(err);
            });
            res.redirect('back');
        })
    });

    return;
});

app.get('/get_tweets/:woeid/:query', (req, res) => {
    City.find({ woeid: req.params.woeid }, (err, cities) => {
        let city = cities[0];
        let latitude = city.centroid[1];
        let longitude = city.centroid[0];
        let r = "5mi";
        let geo = [ latitude, longitude, r ];
        T.get('search/tweets', { q: req.params.query, geocode: geo, count: "100" } , (err, data, response) => {
            if (err) {
                console.log(err);
            } else {
                let tweets = data.statuses;
                for (let i = 0; i < tweets.length; i++) {
                    let t = tweets[i];
                    Tweet.find({ id: t.id }, (err, tweets) => {
                        if (tweets.length == 0) {
                            let tweet = new Tweet();
                            tweet.created_at = t.created_at;
                            tweet.text = t.text;
                            tweet.id = t.id;
                            tweet.woeid = req.params.woeid;
                            tweet.trend = req.params.query;
                            tweet.save((err) => {
                                if (err) {
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

app.get('/analyze_tweets', (req, res) => {
    Tweet.find({ sentiment: null }, (err, tweets) => {
        for (let i = 0; i < tweets.length; i++) {
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
                tweet.save((err) => {
                    if (err) {
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

app.get('/create_graph/:woeid/:query', (req,res) => {
    Tweet.find({ woeid: req.params.woeid, trend: req.params.query, sentiment: { $exists: true }  }, (err, tweets) => {
        let scores = [];
        for (let i = 0; i < tweets.length; i++) {
            let tweet = tweets[i];
            scores.push(tweet["sentiment"]);
        }
        console.log(scores);
        for (let i = 0; i < scores.length; i++) {
            let negative = 0;
            let positive = 0;
            let neutral = 0;

            if (scores[i] > 0.3)
                positive++;
            else if(scores[i] > -0.3)
                neutral++;
            else
                negative++;
        }
        res.redirect('back');
    });
    return;
});

app.get('/remove_duplicates', (req, res) => {
    City.find({}, (err, cities) => {
        for (let i = 0; i < cities.length; i++) {
            if (i != cities.length - 1) {
                let cur = cities[i];
                let next = cities[i+1];
                if ( cur["name"] == next["name"] ) {
                    City.deleteOne({ name: cur["name"] }, (err) => {
                        if (err)
                            console.log(err);
                    });
                }
            }
        }
    });
    console.log('Deleted duplicates');
    res.redirect('back');
});

console.log("Now listening on port 5000");

const PORT = process.env.PORT || 5000;
app.listen(PORT);

