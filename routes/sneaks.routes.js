const SneaksAPI = require('../controllers/sneaks.controllers.js');
const rateLimit = require('express-rate-limit');
const cache = require('../utils/cache');
const response = require('../utils/response');

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { success: false, error: { message: 'Too many requests, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false
});

const sneaks = new SneaksAPI();

module.exports = (app) => {
    // Apply rate limiting to all routes
    app.use('/id', limiter);
    app.use('/search', limiter);
    app.use('/popular', limiter);
    app.use('/home', limiter);

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    // Health check endpoint
    app.get('/health', function (req, res) {
        const cacheStats = cache.getStats();
        return response.success(res, {
            status: 'ok',
            uptime: process.uptime(),
            cache: {
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                keys: cacheStats.keys
            }
        });
    });

    // Cache stats endpoint
    app.get('/cache/stats', function (req, res) {
        return response.success(res, cache.getStats());
    });

    // Clear cache endpoint (protected - add auth in production)
    app.delete('/cache', function (req, res) {
        cache.flush();
        return response.success(res, { message: 'Cache cleared successfully' });
    });

    //Grabs sneaker info from the database given the styleID
    app.get('/id/:id', function (req, res) {
        const cacheKey = `shoe:${req.params.id}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { cached: true });
        }

        sneaks.findOne(req.params.id, function (error, shoe) {
            if (error) {
                return response.notFound(res, "Product Not Found");
            } else {
                cache.set(cacheKey, shoe, 3600); // Cache for 1 hour
                return response.success(res, shoe, { cached: false });
            }
        })
    });

    //Grabs price maps from each site of a particular shoe
    app.get('/id/:id/prices', function (req, res) {
        const cacheKey = `prices:${req.params.id}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { cached: true });
        }

        // First, resolve UUID to styleID if needed
        sneaks.findOne(req.params.id, function (findError, shoe) {
            if (findError || !shoe) {
                return response.notFound(res, "Product Not Found");
            }

            // Use the styleID to fetch prices
            sneaks.getProductPrices(shoe.styleID.toUpperCase(), function (error, products) {
                if (error) {
                    console.error(error);
                    return response.notFound(res, "Product Not Found");
                } else {
                    cache.set(cacheKey, products, 1800); // Cache for 30 minutes (prices change more frequently)
                    return response.success(res, products, { cached: false });
                }
            });
        });
    });

    //grabs the most popular sneakers 
    app.get('/home', function (req, res) {
        const count = parseInt(req.query.count) || 40;
        const cacheKey = `popular:${count}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, cached: true });
        }

        sneaks.getMostPopular(count, function (error, products) {
            if (error) {
                console.error(error);
                return response.error(res, "Could not fetch popular products");
            } else {
                cache.set(cacheKey, products, 1800); // Cache for 30 minutes
                return response.success(res, products, { count: products.length, cached: false });
            }
        })
    });

    //grabs the most popular sneakers (alternative route with count as parameter)
    app.get('/popular/:count', function (req, res) {
        const count = parseInt(req.params.count) || 40;
        const cacheKey = `popular:${count}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached, { count: cached.length, cached: true });
        }

        sneaks.getMostPopular(count, function (error, products) {
            if (error) {
                console.error(error);
                return response.error(res, "Could not fetch popular products");
            } else {
                cache.set(cacheKey, products, 1800); // Cache for 30 minutes
                return response.success(res, products, { count: products.length, cached: false });
            }
        })
    });

    //Grabs all sneakers given a keyword/parameter
    app.get('/search/:shoe', function (req, res) {
        const count = parseInt(req.query.count) || 40;
        const page = parseInt(req.query.page) || 0;
        const keyword = req.params.shoe;
        const cacheKey = `search:${keyword}:${count}:${page}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return response.success(res, cached.products, { count: cached.products.length, keyword, nbHits: cached.nbHits, cached: true });
        }

        sneaks.getProducts(keyword, count, page, function (error, products, nbHits, nbPages) {
            if (error) {
                console.error(error);
                return response.notFound(res, "Product Not Found");
            } else {
                cache.set(cacheKey, { products, nbHits, nbPages }, 3600); // Cache for 1 hour
                return response.success(res, products, { count: products.length, keyword, nbHits, nbPages, cached: false });
            }
        })
    });

    //Grabs all sneakers in the database
    app.get('/shoes', function (req, res) {
        sneaks.findAll(function (error, products) {
            if (error) {
                console.error(error);
                return response.error(res, "No Products In Database");
            } else {
                return response.success(res, products, { count: products.length });
            }
        })
    });

    //redirects root route to home page
    app.get('/', function (req, res) {
        res.redirect('/home')
    });

}