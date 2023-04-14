const mongoose = require("mongoose");

const Schema = mongoose.Schema;

var SneakerSchema = new Schema({
    shoeName: String,
    brand: String,
    silhoutte: String,
    styleID: String,
    retailPrice: Number,
    releaseDate: String,
    description: String,
    imageLinks: [String],
    thumbnail: String,
    urlKey: String,
    make: String,
    category: String,
    designer: String,
    details: String,
    grid_picture_url: String,
    name: String,
    nickname: String,
    release_date: String,
    silhouette: String,
    size_brand: String,
    story_html: String,
    story: String,
    goatProductId: Number,
    goatDetails: {},
    //flightclubDetails: {},
    stockxDetails: {},
    colorway: String,
    resellLinks: {
        stockX: String,
        goat: String,
        flightClub: String
    },
    size: Number,
    lowestResellPrice: {
        stockX: Number,
        goat: Number,
        flightClub: Number
    },
    resellPrices: {
        stockX: {},
        goat: {},
        flightClub: {}
    }

});

var Sneaker = mongoose.model("Sneaker", SneakerSchema);

module.exports = Sneaker;