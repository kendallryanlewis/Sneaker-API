# Sneaker News API Endpoints

## Overview
The News API provides access to the latest sneaker news, releases, and articles from multiple trusted sources including SneakerNews, Sole Collector, Complex, Nike SNKRS, and Nice Kicks.

## Features

- **Caching**: 30 minutes for news articles, 1 hour for release calendars
- **Rate Limiting**: 200 requests per 15 minutes per IP (higher than product endpoints)
- **Standardized Responses**: Consistent JSON format across all endpoints
- **Multiple Sources**: Aggregated content from leading sneaker publications
- **Error Handling**: Graceful degradation if sources are unavailable

## News Endpoints

### 1. Latest News (Aggregated)
Get the latest sneaker news from multiple sources combined.

```
GET /news/latest
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Article title",
      "image": "https://...",
      "url": "https://...",
      "category": "Sneakers",
      "source": "SneakerNews",
      "publishedAt": "2026-01-05T10:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-01-05T10:00:00.000Z",
    "count": 20,
    "source": "aggregated",
    "cached": false
  }
}
```

**Cache:** 30 minutes

---

### 2. SneakerNews Articles
Get latest articles from SneakerNews.com including popular and trending posts.

```
GET /news/sneakernews
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Article title",
      "image": "https://...",
      "url": "https://...",
      "type": "popular",
      "source": "SneakerNews"
    },
    {
      "title": "Another article",
      "image": "https://...",
      "url": "https://...",
      "type": "latest",
      "source": "SneakerNews"
    }
  ],
  "meta": {
    "count": 25,
    "source": "SneakerNews",
    "cached": false
  }
}
```

**Types:**
- `popular` - Popular/trending posts
- `latest` - Most recent articles

**Cache:** 30 minutes

---

### 3. Sole Collector Featured
Get featured articles and latest stories from Sole Collector.

```
GET /news/solecollector
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Featured article",
      "image": "https://...",
      "url": "https://solecollector.com/...",
      "type": "featured",
      "source": "SoleCollector"
    },
    {
      "title": "Standard article",
      "image": "https://...",
      "url": "https://solecollector.com/...",
      "type": "standard",
      "source": "SoleCollector"
    }
  ],
  "meta": {
    "count": 15,
    "source": "SoleCollector",
    "cached": false
  }
}
```

**Types:**
- `featured` - Big featured stories
- `standard` - Regular articles

**Cache:** 30 minutes

---

### 4. Complex Sneaker News
Get sneaker news and articles from Complex.

```
GET /news/complex
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Article title",
      "image": "https://...",
      "url": "https://www.complex.com/sneakers/...",
      "source": "Complex"
    }
  ],
  "meta": {
    "count": 10,
    "source": "Complex",
    "cached": false
  }
}
```

**Cache:** 30 minutes

---

## Release Calendar Endpoints

### 5. Upcoming Releases
Get upcoming sneaker releases with dates and details from Nice Kicks.

```
GET /news/releases/upcoming
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Air Jordan 1 Retro High OG 'Bred Patent'",
      "image": "https://...",
      "url": "https://www.nicekicks.com/...",
      "releaseDate": {
        "month": "Jan",
        "day": "15",
        "display": "Jan 15"
      },
      "details": "Retail Price: $180",
      "source": "NiceKicks"
    }
  ],
  "meta": {
    "count": 30,
    "source": "NiceKicks",
    "cached": false
  }
}
```

**Cache:** 1 hour (releases don't change as frequently)

---

### 6. Nike SNKRS Upcoming Releases
Get upcoming releases from Nike SNKRS app/website.

```
GET /news/releases/snkrs
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Nike Dunk Low 'Panda'",
      "releaseDate": "Jan 10, 2026",
      "image": "https://static.nike.com/...",
      "url": "https://www.nike.com/launch/...",
      "source": "Nike SNKRS"
    }
  ],
  "meta": {
    "count": 12,
    "source": "Nike SNKRS",
    "cached": false
  }
}
```

**Cache:** 1 hour

---

## Rate Limiting

News endpoints have a higher rate limit than product endpoints:
- **Limit:** 200 requests per 15 minutes per IP
- **Reason:** News is informational and less resource-intensive
- **Response when exceeded:** HTTP 429 with error message

**Headers:**
- `RateLimit-Limit: 200`
- `RateLimit-Remaining: 195`
- `RateLimit-Reset: <timestamp>`

---

## Error Handling

All endpoints return standardized error responses:

### Not Found (404)
```json
{
  "success": false,
  "error": {
    "message": "Route /news/invalid not found",
    "code": 404,
    "timestamp": "2026-01-05T10:00:00.000Z"
  }
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": {
    "message": "Failed to fetch articles",
    "code": 500,
    "timestamp": "2026-01-05T10:00:00.000Z"
  }
}
```

---

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Get latest news
async function getLatestNews() {
  try {
    const response = await axios.get('http://localhost:8080/news/latest');
    const { success, data, meta } = response.data;
    
    if (success) {
      console.log(`Found ${meta.count} articles (cached: ${meta.cached})`);
      data.forEach(article => {
        console.log(`- ${article.title} (${article.source})`);
      });
    }
  } catch (error) {
    console.error('Error fetching news:', error.message);
  }
}

// Get upcoming releases
async function getUpcomingReleases() {
  try {
    const response = await axios.get('http://localhost:8080/news/releases/upcoming');
    const { data } = response.data;
    
    data.forEach(release => {
      console.log(`${release.title} - ${release.releaseDate.display}`);
    });
  } catch (error) {
    console.error('Error fetching releases:', error.message);
  }
}
```

### cURL

```bash
# Get latest news
curl http://localhost:8080/news/latest

# Get SneakerNews articles
curl http://localhost:8080/news/sneakernews

# Get upcoming releases
curl http://localhost:8080/news/releases/upcoming

# Get SNKRS releases
curl http://localhost:8080/news/releases/snkrs

# Pretty print with jq
curl -s http://localhost:8080/news/latest | jq '.data[0]'
```

### Python

```python
import requests

# Get latest news
def get_latest_news():
    response = requests.get('http://localhost:8080/news/latest')
    data = response.json()
    
    if data['success']:
        articles = data['data']
        print(f"Found {data['meta']['count']} articles")
        for article in articles[:5]:  # First 5 articles
            print(f"- {article['title']} ({article['source']})")
    else:
        print(f"Error: {data['error']['message']}")

# Get upcoming releases
def get_upcoming_releases():
    response = requests.get('http://localhost:8080/news/releases/upcoming')
    data = response.json()
    
    if data['success']:
        for release in data['data'][:10]:  # First 10 releases
            print(f"{release['title']} - {release['releaseDate']['display']}")
```

---

## Cache Management

### View Cache Stats
```bash
curl http://localhost:8080/cache/stats
```

### Clear All Cache (including news)
```bash
curl -X DELETE http://localhost:8080/cache
```

This will clear both product and news caches.

---

## Performance

- **Cache Hit:** < 50ms response time
- **Cache Miss (first request):** 2-5 seconds (web scraping time)
- **Cache Duration:**
  - News articles: 30 minutes
  - Release calendars: 1 hour
  - Reduces server load by ~95%

---

## Data Sources

| Endpoint | Source | Update Frequency |
|----------|--------|------------------|
| `/news/latest` | Aggregated | 30 minutes |
| `/news/sneakernews` | SneakerNews.com | 30 minutes |
| `/news/solecollector` | SoleCollector.com | 30 minutes |
| `/news/complex` | Complex.com | 30 minutes |
| `/news/releases/upcoming` | NiceKicks.com | 1 hour |
| `/news/releases/snkrs` | Nike.com/launch | 1 hour |

---

## Important Notes

⚠️ **Web Scraping Limitations:**
- These endpoints rely on web scraping, so they may break if source websites change their HTML structure
- Some requests may return empty arrays if the site structure has changed
- Error handling ensures the API doesn't crash, but returns empty data gracefully

✅ **Recommendations:**
- Use caching to reduce requests to external sites
- Monitor error logs for scraping issues
- Consider adding RSS feed parsers as an alternative data source
- Implement fallback mechanisms for critical endpoints

---

## Troubleshooting

### Empty Arrays Returned
If endpoints return `{ "data": [], "count": 0 }`, it means:
1. The website HTML structure has changed
2. The website is blocking requests
3. The website is temporarily unavailable

**Solution:** Check error logs and update CSS selectors in the scraper code.

### Rate Limit Exceeded
If you receive HTTP 429:
- Wait for the rate limit window to reset (15 minutes)
- Implement request queuing on the client side
- Use caching to reduce redundant requests

### Slow Response Times
- First request after cache expiry will be slower (2-5 seconds)
- Subsequent requests within cache window will be fast (<50ms)
- Consider pre-warming cache with scheduled requests

---

## Future Enhancements

Potential improvements for the news API:

1. **RSS Feed Integration** - More reliable than web scraping
2. **Article Content Extraction** - Full article text, not just headlines
3. **Image Optimization** - Resize and cache images locally
4. **Search & Filtering** - Search news by keyword, brand, or date
5. **Pagination** - Limit results per page with offset
6. **Webhooks** - Real-time notifications for breaking news
7. **Archive** - Historical news data storage
8. **Social Media Integration** - Twitter/Instagram sneaker news
9. **AI Summarization** - Generate article summaries
10. **Personalization** - User-specific news preferences

---

## Support

For issues with news endpoints:
1. Check if the API is running: `curl http://localhost:8080/health`
2. Clear cache and retry: `curl -X DELETE http://localhost:8080/cache`
3. Check server logs for scraping errors
4. Verify source websites are accessible
5. Report issues with specific endpoint and error message
