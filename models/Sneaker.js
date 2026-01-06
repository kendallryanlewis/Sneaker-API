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
    id: String,
    uuid: String,
    objectID: String, // StockX Algolia objectID (UUID format)
    thumbnail_url: String,
    imageUrl: String,
    highest_bid: String,
    lowest_ask: String,
    last_sale: String,
    goatDetails: {},
    flightclubDetails: {},
    stockxDetails: {},
    colorway: String,
    
    // Product specifications
    upperMaterial: String,
    midsole: String,
    release_year: Number,
    release_month: Number,
    
    // StockX market data
    sales_last_72: Number,
    deadstock_sold: Number,
    total_dollars: Number,
    
    // Image collections from different sources
    goatImages: {
        grid_picture_url: String,
        grid_glow_picture_url: String,
        grid_display_picture_url: String,
        main_picture_url: String,
        main_glow_picture_url: String,
        main_display_picture_url: String,
        original_picture_url: String
    },
    stockxImages: {
        imageUrl: String,
        smallImageUrl: String,
        thumbUrl: String,
        thumbnail_url: String,
        gallery: [String]
    },
    
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
        flightClub: {},
        stadiumGoods: {}
    },
    // New fields for enhanced functionality
    images: [{
        url: String,
        angle: String, // 'main', 'side', 'back', 'top', 'bottom', 'detail'
        source: String // 'stockx', 'goat', 'flightclub'
    }],
    sizeAvailability: {
        type: Map,
        of: Boolean // true if available, false if out of stock
    },
    priceHistory: [{
        date: { type: Date, default: Date.now },
        stockX: Number,
        goat: Number,
        flightClub: Number,
        stadiumGoods: Number
    }],
    releaseStatus: {
        type: String,
        enum: ['upcoming', 'available', 'limited', 'sold_out'],
        default: 'available'
    },
    popularity: {
        searchCount: { type: Number, default: 0 },
        viewCount: { type: Number, default: 0 },
        lastSearched: Date,
        lastViewed: Date
    },
    metadata: {
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        lastScraped: Date,
        scrapedSources: [String]
    }

});

var Sneaker = mongoose.model("Sneaker", SneakerSchema);

module.exports = Sneaker;