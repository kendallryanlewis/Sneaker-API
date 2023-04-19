const got = require('got');
const axios = require('axios');


module.exports = {
    getLink: async function(shoe, callback) {
        try {
            url = 'https://2fwotdvm2o-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20vanilla%20JavaScript%20(lite)%203.25.1%3Breact%20(16.9.0)%3Breact-instantsearch%20(6.2.0)%3BJS%20Helper%20(3.1.0)&x-algolia-application-id=2FWOTDVM2O&x-algolia-api-key=ac96de6fef0e02bb95d433d8d5c7038a'
            const response = await got.post(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15',
                    'Content-Type': 'application/json'
                },
                body: '{"requests":[{"indexName":"product_variants_v2","params":"distinct=true&maxValuesPerFacet=1&page=0&query=' + shoe.styleID + '&facets=%5B%22instant_ship_lowest_price_cents"}]}',
                http2: true,
            });
            var json = JSON.parse(response.body);
            if (json.results[0].hits[0]) {
                if (json.results[0].hits[0].lowest_price_cents_usd / 100 != 0) {
                    shoe.lowestResellPrice.goat = json.results[0].hits[0].lowest_price_cents_usd / 100;
                }
                //shoe.goatDetails = json.results[0].hits[0];
                shoe.category = json.results[0].hits[0].category;
                shoe.designer = json.results[0].hits[0].designer;
                shoe.details = json.results[0].hits[0].details;
                shoe.grid_picture_url = json.results[0].hits[0].grid_picture_url;
                shoe.name = json.results[0].hits[0].name;
                shoe.nickname = json.results[0].hits[0].nickname;
                shoe.release_date = json.results[0].hits[0].release_date;
                shoe.silhouette = json.results[0].hits[0].silhouette;
                shoe.size_brand = json.results[0].hits[0].size_brand;
                shoe.story_html = json.results[0].hits[0].story_html;
                shoe.story = json.results[0].hits[0].story;
                shoe.goatProductId = json.results[0].hits[0].product_template_id;
                shoe.resellLinks.goat = 'https://www.goat.com/sneakers/' + json.results[0].hits[0].slug;
            }

            callback();
        } catch (error) {
            let err = new Error("Could not connect to Goat while searching link '" + shoe.styleID + "' Error: ", error)
            console.log(err);
            callback(err)
        }
    },
    getPrices: async function(shoe, callback) {
        if (!shoe.resellLinks.goat) {
            callback()
        } else {
            let url = 'https://www.goat.com/web-api/v1/product_variants/buy_bar_data?productTemplateId=' + shoe.product_template_id + '&countryCode=US'
            let apiLink = `https://www.goat.com/web-api/v1/product_variants/buy_bar_data?productTemplateId=${shoe.goatProductId}&countryCode=US`;

            let priceMap = {};
            axios({
                    method: 'get',
                    url,
                    headers: { withCredentials: true, 'User-Agent': 'Postman' }
                })
                .then(json => {
                    var json = JSON.parse(response.body);
                    for (var i = 0; i < json.length; i++) {
                        if (json[i].shoeCondition == 'used') continue;
                        if (priceMap[json[i].sizeOption.value]) {
                            priceMap[json[i].sizeOption.value] = json[i].lowestPriceCents.amount / 100 < priceMap[json[i].sizeOption.value] ? json[i].lowestPriceCents.amount / 100 : priceMap[json[i].sizeOption.value];
                        } else {
                            priceMap[json[i].sizeOption.value] = json[i].lowestPriceCents.amount / 100;
                        }
                    }
                    shoe.resellPrices.goat = priceMap;
                    console.log(priceMap)
                    callback()
                })
                .catch(err => {
                    console.log('err', err);
                    callback(err);
                })
            try {
                const releases = [];
                const response = await got(apiLink, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15',
                        'Content-Type': 'application/json'
                    },
                    http2: true,
                });
                var json = JSON.parse(response.body);
                for (var i = 0; i < json.length; i++) {
                    if (json[i].shoeCondition == 'used') continue;
                    if (priceMap[json[i].sizeOption.value]) {
                        priceMap[json[i].sizeOption.value] = json[i].lowestPriceCents.amount / 100 < priceMap[json[i].sizeOption.value] ? json[i].lowestPriceCents.amount / 100 : priceMap[json[i].sizeOption.value];
                    } else {
                        priceMap[json[i].sizeOption.value] = json[i].lowestPriceCents.amount / 100;
                    }
                }
                shoe.resellPrices.goat = priceMap;
                callback()
            } catch (error) {
                let err = new Error("Could not connect to Goat while searching new '" + apiLink + "' Error: ", error)
                console.log(err);
                callback(err)
            }
        }
    },
    getPictures: async function(shoe, callback) {
        if (!shoe.resellLinks.goat) {
            callback()
        } else {
            let apiLink = shoe.resellLinks.goat.replace('sneakers', 'web-api/v1/product_templates');
            //let apiLink = 'https://www.goat.com/web-api/v1/product_variants/buy_bar_data?productTemplateId=' + shoe.goatDetails.product_template_id + '&countryCode=US'
            //let apiLink = `https://www.goat.com/web-api/v1/product_variants/buy_bar_data?productTemplateId=${shoe.goatProductId}&countryCode=US`;

            try {
                const response = await got(apiLink, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.4 Safari/605.1.15',
                        'Content-Type': 'application/json'
                    },
                    http2: true,
                });
                var json = JSON.parse(response.body);
                if (json.productTemplateExternalPictures) {
                    if (json.productTemplateExternalPictures[0]) {
                        shoe.imageLinks.push(json.productTemplateExternalPictures[0].mainPictureUrl);
                    }
                    if (json.productTemplateExternalPictures[2]) {
                        shoe.imageLinks.push(json.productTemplateExternalPictures[2].mainPictureUrl);
                    }
                    if (json.productTemplateExternalPictures[5]) {
                        shoe.imageLinks.push(json.productTemplateExternalPictures[5].mainPictureUrl);
                    }
                    if (json.productTemplateExternalPictures[7]) {
                        shoe.imageLinks.push(json.productTemplateExternalPictures[7].mainPictureUrl);
                    }
                    if (json.productTemplateExternalPictures[3]) {
                        shoe.imageLinks.push(json.productTemplateExternalPictures[3].mainPictureUrl);
                    }
                }
                callback(shoe);
            } catch (error) {
                let err = new Error("Could not connect to Goat while grabbing pictures for '" + shoe.styleID + "' Error: ", error)
                console.log(err);
                callback(err)
            }
        }
    }
}