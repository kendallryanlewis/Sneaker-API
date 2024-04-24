const got = require('got');

module.exports = {
    getLink: async function(shoe, callback) {
        try {
            const body = JSON.stringify({
                requests: [{
                    indexName: "product_variants_v2_flight_club",
                    params: `query=${shoe.styleID}&hitsPerPage=1&maxValuesPerFacet=1&filters=&facets=["lowest_price_cents_usd"]&tagFilters=`
                }]
            });

            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; rv:20.0) Gecko/20121202 Firefox/20.0',
                    'Content-Type': 'application/json'
                },
                body: body
            };

            const response = await got.post("https://2fwotdvm2o-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20vanilla%20JavaScript%20(lite)%203.32.0%3Breact-instantsearch%205.4.0%3BJS%20Helper%202.26.1&x-algolia-application-id=2FWOTDVM2O&x-algolia-api-key=ac96de6fef0e02bb95d433d8d5c7038a", options);
            const data = JSON.parse(response.body);

            if (data.results[0].hits.length > 0) {
                const hit = data.results[0].hits[0];
                shoe.lowestResellPrice.flightClub = hit.lowest_price_cents_usd / 100;
                shoe.resellLinks.flightClub = 'https://www.flightclub.com/' + hit.slug;
                shoe.description = hit.story;
                shoe.flightclubDetails = data.results[0];
                callback(null, shoe);
            } else {
                throw new Error("No hits found for the given style ID.");
            }
        } catch (error) {
            console.error("Error fetching product link:", error);
            callback(error);
        }
    },

    getPrices: async function(shoe, callback) {
        if (!shoe.resellLinks.flightClub) {
            callback(new Error("No resell link available."));
            return;
        }

        try {
            const slug = shoe.resellLinks.flightClub.split('.com/')[1];
            const tokenResponse = await got('https://www.flightclub.com/token', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; rv:20.0) Gecko/20121202 Firefox/20.0'
                }
            });
            const token = tokenResponse.body;

            const graphqlResponse = await got.post('https://www.flightclub.com/graphql', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; rv:20.0) Gecko/20121202 Firefox/20.0',
                    'Content-Type': 'application/json',
                    'x-csrf-token': token
                },
                body: JSON.stringify({
                    operationName: "getProductTemplate",
                    variables: { slug: slug },
                    query: `query getProductTemplate($slug: String!) {
                        getProductTemplate(slug: $slug) {
                            newSizes {
                                size { display }
                                lowestPriceOption { price { value } }
                            }
                        }
                    }`
                }),
                http2: true
            });

            const json = JSON.parse(graphqlResponse.body);
            const priceMap = {};
            json.data.getProductTemplate.newSizes.forEach(size => {
                priceMap[size.size.display] = size.lowestPriceOption.price.value / 100;
            });

            shoe.resellPrices.flightClub = priceMap;
            callback(null, shoe);
        } catch (error) {
            console.error("Error fetching prices:", error);
            callback(error);
        }
    }
};
