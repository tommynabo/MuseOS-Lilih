import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

export const searchLinkedInPosts = async (keywords: string[], maxPosts = 5) => {
    // Actor: buIWk2uOUzTmcLsuB (LinkedIn Post Search)
    // Enhanced search to find HIGH QUALITY posts (>100 likes)
    const input = {
        maxPosts: maxPosts * 3, // Fetch 3x more to filter by engagement
        maxReactions: 10,
        scrapeComments: true,
        scrapeReactions: true,
        searchQueries: keywords,
        sortBy: "relevance"
    };

    try {
        const run = await client.actor("buIWk2uOUzTmcLsuB").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        // Filter by engagement: Must have >100 likes OR >20 comments
        const qualityPosts = items
            .filter((item: any) => {
                const likes = item.likesCount || item.likesNumber || 0;
                const comments = item.commentsCount || item.commentsNumber || 0;
                return likes > 100 || comments > 20;
            })
            .sort((a: any, b: any) => {
                const scoreA = (a.likesCount || 0) + (a.commentsCount || 0) * 3;
                const scoreB = (b.likesCount || 0) + (b.commentsCount || 0) * 3;
                return scoreB - scoreA;
            })
            .slice(0, maxPosts);
        
        console.log(`Found ${items.length} posts, filtered ${qualityPosts.length} high-engagement posts`);
        return qualityPosts;
    } catch (error) {
        console.error("Apify Search Error:", error);
        return [];
    }
};

export const getCreatorPosts = async (profileUrls: string[], maxPosts = 3) => {
    // Actor: A3cAPGpwBEG8RJwse (LinkedIn Profile Scraper / Post Scraper) 
    // Fetch posts from high-engagement creators only
    const input = {
        includeQuotePosts: true,
        includeReposts: false, // Don't include reposts to get original content
        maxComments: 10,
        maxPosts: maxPosts * 2, // Fetch 2x more to filter
        maxReactions: 10,
        postedLimit: "month", // Extended to 1 month for more data
        scrapeComments: true,
        scrapeReactions: true,
        targetUrls: profileUrls
    };

    try {
        const run = await client.actor("A3cAPGpwBEG8RJwse").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        // Filter by engagement: >50 likes OR >10 comments (lower threshold for creator posts)
        const qualityPosts = items
            .filter((item: any) => {
                const likes = item.likesCount || item.likesNumber || 0;
                const comments = item.commentsCount || item.commentsNumber || 0;
                return likes > 50 || comments > 10;
            })
            .sort((a: any, b: any) => {
                const scoreA = (a.likesCount || 0) + (a.commentsCount || 0) * 3;
                const scoreB = (b.likesCount || 0) + (b.commentsCount || 0) * 3;
                return scoreB - scoreA;
            })
            .slice(0, maxPosts);
        
        console.log(`Creator posts: filtered ${items.length} to ${qualityPosts.length} high-engagement posts`);
        return qualityPosts;
    } catch (error) {
        console.error("Apify Creator Posts Error:", error);
        return [];
    }
};

export const searchGoogleNews = async (keywords: string[], maxArticles = 5) => {
    // Actor: 3Z6SK7F2WoPU3t2sg (Google News Scraper)
    const input = {
        extractDescriptions: true,
        keywords: keywords,
        maxArticles: maxArticles,
        region_language: "es-ES", // Changed to Spanish as per user request context
        timeframe: "7d"
    };

    try {
        const run = await client.actor("3Z6SK7F2WoPU3t2sg").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        return items;
    } catch (error) {
        console.error("Apify News Error:", error);
        return [];
    }
}
