const express = require('express');
const axios = require('axios');
const _ = require('lodash');

const app = express();
let blogs;
let blogStatsCache;
let blogSearchCache;
const cacheExpirationTime = 10 * 60 *1000;

async function fetchBlogsData() {
  try {
    const response = await axios.get('https://intent-kit-16.hasura.app/api/rest/blogs', {
      headers: {
        'x-hasura-admin-secret': '32qR4KmXOIpsGPQKMqEJHGJS27G5s7HdSKO3gdtQd2kv5e852SiYwWNfxkZOBuQ6',
      },
    });
    blogs = response.data.blogs;
    blogStatsCache = null;
    blogSearchCache = {};
  } catch (error) {
    console.error('Unable to fetch blog data:', error.message);
  }
}

const getBlogStats = (blogs) => {
  const totalNoOfBlogs = blogs.length;
  const longestBlogTitle = _.maxBy(blogs, 'title.length');
  const privacyConsistBlogs = _.filter(blogs, (blog) => _.includes(blog.title.toLowerCase(), 'privacy'));
  const uniqueTitles = _.uniqBy(blogs, 'title');

  return {
    totalNoOfBlogs,
    longestBlogTitle: longestBlogTitle.title,
    privacyConsistBlogs: privacyConsistBlogs.length,
    uniqueTitles: uniqueTitles.map((blog) => blog.title),
  };
};

const memoizedStats = async () => {
  if (blogStatsCache && Date.now() - (blogStatsCache?.timestamp || 0) < cacheExpirationTime) {
    return blogStatsCache.data;
  }
  await fetchBlogsData();
  const blogStats = getBlogStats(blogs);
  blogStatsCache = {
    data: blogStats,
    timestamp: Date.now(),
  };
  return blogStats;
};

const memoizedSearchCache = async (query) => {
  if (blogSearchCache[query] && Date.now() - (blogSearchCache[query]?.timestamp || 0) < cacheExpirationTime) {
    return blogSearchCache[query].data;
  }
  await fetchBlogsData();
  const searchResults = blogs.filter(
    (blog) => blog.title.toLowerCase().includes(query.toLowerCase())
  );

  blogSearchCache[query] = {
    data: searchResults,
    timestamp: Date.now(),
  };

  return searchResults;
};

app.get('/api/blog-stats', async (req, res) => {
  if (!blogs) {
    await fetchBlogsData();
  }

  if (blogs) {
    const stats = await memoizedStats();
    res.json(stats);
  } else {
    res.status(500).json({ error: 'Unable to fetch blog data.' });
  }
});

app.get('/api/blog-search', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required.' });
  }

  if (!blogs) {
    await fetchBlogsData();
  }

  if (blogs) {
    const searchResults = await memoizedSearchCache(query);

    if (searchResults.length === 0) {
      res.json({ message: 'Blog is not present with this query.' });
    } else {
      res.json(searchResults);
    }
  } else {
    res.status(500).json({ error: 'Unable to fetch blog.' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
