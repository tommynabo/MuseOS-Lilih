import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

/**
 * CONTENT FILTERS
 * Filter posts by language and topic
 */

// Keywords that indicate job search / personal search content (to exclude)
const JOB_SEARCH_KEYWORDS = [
    'buscar trabajo', 'searching for a job', 'looking for a job', 'hiring', 'contratación',
    'oferta de trabajo', 'job offer', 'cv', 'currículum', 'resume', 'estoy disponible',
    'im available', 'open to opportunities', 'abierto a oportunidades',
    'busco empleo', 'job seeker', 'buscador de empleo', 'freelancer disponible',
    'disponible para proyecto', 'looking for coworkers', 'busco socios',
    'partner search', 'compañero de proyecto', 'team building', 'recruitment',
    'we are hiring', 'estamos contratando', 'job application', 'candidato',
    'solicitud de empleo', 'networking social', 'conexiones profesionales rápidas'
];

// Spanish language keywords/patterns
const SPANISH_INDICATORS = [
    'que', 'de', 'la', 'el', 'en', 'con', 'para', 'por', 'y', 'a', 'es', 'se',
    'del', 'los', 'una', 'las', 'un', 'qué', 'ór', 'ó', 'á', 'í', 'ú', 'é',
    'trabajo', 'empresa', 'desde', 'hasta', 'porque', 'entonces', 'mientras',
    'durante', 'aunque', 'sino', 'contra'
];

// English language keywords/patterns
const ENGLISH_INDICATORS = [
    'the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'that', 'for', 'you',
    'as', 'be', 'on', 'with', 'are', 'or', 'an', 'was', 'by', 'at', 'have'
];

// Detect if content is primarily in Spanish or English
function detectLanguage(text: string): 'es' | 'en' | null {
    if (!text || text.length < 20) return null;
    
    const lowerText = text.toLowerCase();
    
    let spanishScore = 0;
    let englishScore = 0;
    
    // Count Spanish indicators
    SPANISH_INDICATORS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        spanishScore += (lowerText.match(regex) || []).length;
    });
    
    // Count English indicators
    ENGLISH_INDICATORS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        englishScore += (lowerText.match(regex) || []).length;
    });
    
    // Check for Spanish accented characters
    if (/[áéíóúñü]/.test(text)) {
        spanishScore += 5;
    }
    
    // Determine language
    if (spanishScore > englishScore) {
        return 'es';
    } else if (englishScore > spanishScore) {
        return 'en';
    }
    
    return null;
}

// Check if post is about job search or personal recruitment
function isJobSearchRelated(text: string): boolean {
    if (!text || text.length === 0) return false;
    
    const lowerText = text.toLowerCase();
    
    // Check for job search keywords
    return JOB_SEARCH_KEYWORDS.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
    );
}

/**
 * Extract text from post (handles different data structures)
 */
function extractPostText(post: any): string {
    return (
        post.text ||
        post.postText ||
        post.content ||
        post.description ||
        ''
    ).trim();
}

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

        // Filter by engagement: Relaxed threshold to catch "Hidden Gems"
        // We look for >30 likes (instead of 100) OR >5 comments
        // PLUS: New filters for language and topic
        const qualityPosts = items
            .filter((item: any) => {
                const likes = item.likesCount || item.likesNumber || 0;
                const comments = item.commentsCount || item.commentsNumber || 0;
                const postText = extractPostText(item);
                
                // Engagement filter
                if (!(likes > 30 || comments > 5)) {
                    return false;
                }
                
                // Language filter: Only Spanish or English
                const language = detectLanguage(postText);
                if (!language || !['es', 'en'].includes(language)) {
                    console.log(`Filtered out post: Language detected as ${language}`);
                    return false;
                }
                
                // Topic filter: Exclude job search related content
                if (isJobSearchRelated(postText)) {
                    console.log(`Filtered out post: Job search related content`);
                    return false;
                }
                
                return true;
            })
            .sort((a: any, b: any) => {
                // Initial sort by comments weight (conversation is key)
                const scoreA = (a.likesCount || 0) + (a.commentsCount || 0) * 5;
                const scoreB = (b.likesCount || 0) + (b.commentsCount || 0) * 5;
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

        // Filter by engagement: Relaxed for creators too (>20 likes or >3 comments)
        // PLUS: New filters for language and topic
        const qualityPosts = items
            .filter((item: any) => {
                const likes = item.likesCount || item.likesNumber || 0;
                const comments = item.commentsCount || item.commentsNumber || 0;
                const postText = extractPostText(item);
                
                // Engagement filter
                if (!(likes > 20 || comments > 3)) {
                    return false;
                }
                
                // Language filter: Only Spanish or English
                const language = detectLanguage(postText);
                if (!language || !['es', 'en'].includes(language)) {
                    console.log(`Filtered out creator post: Language detected as ${language}`);
                    return false;
                }
                
                // Topic filter: Exclude job search related content
                if (isJobSearchRelated(postText)) {
                    console.log(`Filtered out creator post: Job search related content`);
                    return false;
                }
                
                return true;
            })
            .sort((a: any, b: any) => {
                const scoreA = (a.likesCount || 0) + (a.commentsCount || 0) * 5;
                const scoreB = (b.likesCount || 0) + (b.commentsCount || 0) * 5;
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
