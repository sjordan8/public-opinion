const mongoose = require('mongoose');

let citySchema = mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    woeid:{
        type: Number,
        required: true
    },
    centroid:{
        type: Array,
        required: false
    },
    trends:{
        type: Array,
        required: false
    }
});

let City = module.exports = mongoose.model('City', citySchema);
