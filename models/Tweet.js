const mongoose = require('mongoose');

let tweetSchema = mongoose.Schema({
    created_at:{
        type: String,
        required: true
    },
    text:{
        type: String,
        required: true
    },
    id:{
        type: Number,
        required: true
    },
    woeid:{
        type: Number,
        required: true
    },
    sentiment:{
        type: Number,
        required: false
    },
    trend:{
        type: String,
        required: true
    }
});

let Tweet = module.exports = mongoose.model('Tweet', tweetSchema);
