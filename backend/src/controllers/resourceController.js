import ytSearch from "yt-search";

export const getResources = async (req, res, next) => {
    try {
        const { q, topic } = req.query;
        if (!q || !topic) {
            return res.status(400).json({ error: "Query parameters 'q' and 'topic' are required" });
        }

        // Run YouTube search
        const ytResults = await ytSearch(q);

        // Format YouTube Videos
        let videos = [];
        if (ytResults && ytResults.videos) {
            videos = ytResults.videos.slice(0, 5).map(v => ({
                id: v.videoId,
                title: v.title,
                url: v.url,
                thumbnail: v.thumbnail,
                timestamp: v.timestamp,
                author: v.author.name
            }));
        }

        // Since live Google scraping from a Node server often gets blocked by CAPTCHAs,
        // we synthesize direct search links to high-quality tutorial websites.
        const encodedTopic = encodeURIComponent(topic);
        const articles = [
            {
                title: `${topic} Tutorial on GeeksforGeeks`,
                url: `https://www.google.com/search?q=site:geeksforgeeks.org+${encodedTopic}+tutorial`,
                description: `Comprehensive guide and examples for ${topic} on GeeksforGeeks.`
            },
            {
                title: `${topic} Documentation on MDN Web Docs`,
                url: `https://developer.mozilla.org/en-US/search?q=${encodedTopic}`,
                description: `Authoritative web development documentation for ${topic} by Mozilla.`
            },
            {
                title: `${topic} Basics on W3Schools`,
                url: `https://www.google.com/search?q=site:w3schools.com+${encodedTopic}+tutorial`,
                description: `Beginner-friendly interactive tutorial for ${topic} from W3Schools.`
            },
            {
                title: `${topic} Articles on FreeCodeCamp`,
                url: `https://www.freecodecamp.org/news/search?q=${encodedTopic}`,
                description: `In-depth articles and guides related to ${topic} from the open source community.`
            },
            {
                title: `Community Posts on Dev.to about ${topic}`,
                url: `https://dev.to/search?q=${encodedTopic}`,
                description: `Practical tips, code snippets, and discussions about ${topic}.`
            }
        ];

        res.json({
            query: q,
            videos,
            articles
        });
    } catch (error) {
        next(error);
    }
};
