// SINGLE FILE API - All code inline to avoid Vercel ESM resolution issues
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import OpenAI from 'openai';

// ===== CONFIGURATION =====
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

// ===== CLIENTS =====
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const apifyClient = new ApifyClient({ token: APIFY_TOKEN });

const openai = new OpenAI({ apiKey: OPENAI_KEY });

const getSupabaseUserClient = (accessToken: string) => {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
};

// ===== EXPRESS APP =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== AUTH MIDDLEWARE =====
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Invalid token format' });
    (req as any).token = token;
    next();
};

const getUserSupabase = (req: Request) => getSupabaseUserClient((req as any).token);

// ===== INTERFACES =====
interface ApifyPost {
    id?: string;
    url?: string;
    text?: string;
    postText?: string;
    content?: string;
    description?: string;
    author?: { name?: string };
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    likesNumber?: number;
    commentsNumber?: number;
    sharesNumber?: number;
}

// ===== HELPER FUNCTIONS =====
function extractPostText(post: ApifyPost): string {
    return (
        post.text ||
        post.postText ||
        post.content ||
        post.description ||
        ''
    ).trim().substring(0, 500);
}

function getMetric(post: ApifyPost, metric: 'likes' | 'comments' | 'shares'): number {
    switch (metric) {
        case 'likes':
            return post.likesCount || post.likesNumber || 0;
        case 'comments':
            return post.commentsCount || post.commentsNumber || 0;
        case 'shares':
            return post.sharesCount || post.sharesNumber || 0;
    }
}

// ===== APIFY FUNCTIONS =====
async function searchLinkedInPosts(keywords: string[], maxPosts = 5): Promise<ApifyPost[]> {
    try {
        const run = await apifyClient.actor("buIWk2uOUzTmcLsuB").call({
            maxPosts, maxReactions: 5, scrapeComments: true, scrapeReactions: true,
            searchQueries: keywords, sortBy: "relevance"
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        return items as ApifyPost[];
    } catch (error) {
        console.error("Apify Search Error:", error);
        return [];
    }
}

async function getCreatorPosts(profileUrls: string[], maxPosts = 3): Promise<ApifyPost[]> {
    try {
        const run = await apifyClient.actor("A3cAPGpwBEG8RJwse").call({
            includeQuotePosts: true, includeReposts: true, maxComments: 5, maxPosts,
            maxReactions: 5, postedLimit: "week", scrapeComments: true, scrapeReactions: true,
            targetUrls: profileUrls
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        return items as ApifyPost[];
    } catch (error) {
        console.error("Apify Creator Posts Error:", error);
        return [];
    }
}

// ===== OPENAI FUNCTIONS =====
// ===== OPTIMIZED AI FUNCTIONS =====

// 1. QUERY EXPANSION
async function expandSearchQuery(topic: string): Promise<string[]> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: "Eres un experto en boolean search." },
            { role: "user", content: `Transforma "${topic}" en 3 búsquedas booleanas para LinkedIn (JSON: {queries: []}).` }],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(response.choices[0].message.content || '{"queries": []}');
        return result.queries.length > 0 ? result.queries : [topic];
    } catch (e) { return [topic]; }
}

// 2. RELATIVE VIRALITY SCORING
async function evaluatePostEngagement(posts: ApifyPost[]): Promise<ApifyPost[]> {
    if (posts.length === 0) return [];

    // Quick pre-filter to save tokens
    const meaningfulPosts = posts.filter(p => {
        const likes = p.likesCount || 0;
        const comments = p.commentsCount || 0;
        return likes > 10 || comments > 2; // Relaxed floor
    });

    if (meaningfulPosts.length === 0) return posts.slice(0, 3);

    const postsData = meaningfulPosts.slice(0, 15).map((p, idx) => ({ // Limit analysis to 15 posts max
        index: idx,
        text: extractPostText(p).substring(0, 200),
        metrics: {
            likes: getMetric(p, 'likes'),
            comments: getMetric(p, 'comments'),
            shares: getMetric(p, 'shares'),
            ratio: getMetric(p, 'comments') / (getMetric(p, 'likes') || 1)
        }
    }));

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Select top 3 hidden gems based on engagement ratios." },
                { role: "user", content: JSON.stringify(postsData) }
            ],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(response.choices[0].message.content || '{"indices": []}');
        const indices = result.indices || result.high_engagement_indices || [];

        if (indices.length === 0) throw new Error("No AI selection");

        return indices.map((i: number) => meaningfulPosts[i]).filter(Boolean);
    } catch (error) {
        // Fallback: Sort by comments/likes ratio
        return meaningfulPosts.sort((a, b) => {
            const ratioA = getMetric(a, 'comments') / (getMetric(a, 'likes') || 1);
            const ratioB = getMetric(b, 'comments') / (getMetric(b, 'likes') || 1);
            return ratioB - ratioA;
        }).slice(0, 5);
    }
}

// 3. STRUCTURE EXTRACTION
async function extractPostStructure(content: string): Promise<string> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: "Extract viral structure JSON." }, { role: "user", content: content }],
            response_format: { type: "json_object" }
        });
        return response.choices[0].message.content || '{}';
    } catch { return '{}'; }
}

function filterSensitiveData(text: string): string {
    // Remove phone numbers (various formats)
    let filtered = text.replace(/(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, '[TELÉFONO]');
    // Remove WhatsApp numbers
    filtered = filtered.replace(/\(?WhatsApp\)?[\s]?[\d\s\-\(\)]+/gi, '[WHATSAPP]');
    // Remove email addresses
    filtered = filtered.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[EMAIL]');
    // Remove URLs (www.*, http://*, https://)
    filtered = filtered.replace(/https?:\/\/[^\s]+|www\.[^\s]+/gi, '[WEBSITE]');
    // Remove physical addresses
    filtered = filtered.replace(/(?:Rua|Avenida|Av\.|Calle|Street|Rua|Rute|nº|Número|Loja|Edifício|Moçambique|Portugal|Brasil|España|México|Argentina)\s+[^\.]*\.?/gi, (match) => {
        if (/\d/.test(match)) return '[DIRECCIÓN]';
        return match;
    });
    // Remove geographic coordinates
    filtered = filtered.replace(/📍\s*[^[\n]*/gi, '[UBICACIÓN]');
    filtered = filtered.replace(/Maputo|Lisboa|Porto|Rio de Janeiro|São Paulo/gi, '[CIUDAD]');
    return filtered.trim();
}

// 4. REWRITE
async function regeneratePost(structure: string, original: string, instructions: string): Promise<string> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: instructions || "Ghostwriter expert." },
                { role: "user", content: `Rewrite based on structure: ${structure} \n Context: ${original.substring(0, 500)}` }
            ]
        });
        return response.choices[0].message.content || '';
    } catch { return original; }
}

// ===== MAIN WORKFLOW (OPTIMIZED) =====
app.post('/api/workflow/generate', requireAuth, async (req, res) => {
    // Set timeout to handle long Vercel functions (though response must be sent before hard limit)
    req.setTimeout(60000);

    const { source, count = 1 } = req.body; // Default to 1 to be safe
    const supabase = getUserSupabase(req);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { data: profile } = await supabase.from('profiles').select('*').single();
        if (!profile) return res.status(400).json({ error: "Configure settings first." });

        const keywords = profile.niche_keywords || [];
        const customInstructions = profile.custom_instructions || '';
        let allPosts: ApifyPost[] = [];

        // 1. FETCH & EXPAND (Parallelized)
        if (source === 'keywords') {
            if (keywords.length === 0) return res.status(400).json({ error: "No keywords." });

            // Limit to top 2 keywords for speed
            const activeKeywords = keywords.slice(0, 2);

            // Expand in parallel
            const expandedLists = await Promise.all(activeKeywords.map((k: string) => expandSearchQuery(k)));
            const searchQueries = [...new Set(expandedLists.flat())].slice(0, 3); // Max 3 final queries

            // Search in parallel
            const searchPromises = searchQueries.map(q => searchLinkedInPosts([q], 2));
            const results = await Promise.all(searchPromises);
            allPosts = results.flat();

        } else {
            const { data: creators } = await supabase.from('creators').select('linkedin_url');
            if (!creators?.length) return res.status(400).json({ error: "No creators." });
            const urls = creators.slice(0, 5).map((c: any) => c.linkedin_url);
            allPosts = await getCreatorPosts(urls, 5);
        }

        // 2. ANALYZE (The Sniffer)
        const bestPosts = await evaluatePostEngagement(allPosts);

        // 3. GENERATE (The Architect + Writer) - Process Top N in Parallel
        // Only process requested count to save time
        const postsToProcess = bestPosts.slice(0, count);

        const generatedResults = await Promise.all(postsToProcess.map(async (post) => {
            const postText = extractPostText(post);
            if (!postText) return null;

            const filtered = filterSensitiveData(postText);

            // Run structure extraction and rewriting
            const structure = await extractPostStructure(filtered);
            const rewritten = await regeneratePost(structure, filtered, customInstructions);

            // Save to DB (Fire and forget provided we catch errors)
            const { error } = await supabase.from('posts').insert({
                user_id: user.id,
                original_content: postText,
                generated_content: rewritten,
                type: source === 'keywords' ? 'research' : 'parasite',
                status: 'idea',
                meta: { structure, original_url: post.url, engagement: { likes: getMetric(post, 'likes'), comments: getMetric(post, 'comments') } }
            });

            if (error) console.error("DB Insert Error", error);

            return {
                original: postText.substring(0, 200) + '...',
                generated: rewritten,
                sourceUrl: post.url
            };
        }));

        const validResults = generatedResults.filter(Boolean);

        res.json({
            status: 'success',
            data: validResults,
            message: `${validResults.length} posts generated`
        });

    } catch (error: any) {
        console.error("Workflow error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Legacy endpoints
app.post('/api/workflow/parasite', requireAuth, async (req, res) => {
    req.body.source = 'creators';
    return app._router.handle(req, res, () => { });
});

app.post('/api/workflow/research', requireAuth, async (req, res) => {
    req.body.source = 'keywords';
    return app._router.handle(req, res, () => { });
});

export default app;
