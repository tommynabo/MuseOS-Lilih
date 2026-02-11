// SINGLE FILE API - All code inline to avoid Vercel ESM resolution issues
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import OpenAI from 'openai';

// ===== CONFIGURATION =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ===== CLIENTS =====
// Initialize safely to prevent 500 startup crashes if env vars are missing
const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    : null;

const apifyClient = APIFY_TOKEN ? new ApifyClient({ token: APIFY_TOKEN }) : null;

const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

const getSupabaseUserClient = (accessToken: string) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Supabase not configured on server");
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
    [key: string]: any; // Allow any field from Apify — actors vary widely
    id?: string;
    url?: string;
    postUrl?: string;
    text?: string;
    postText?: string;
    content?: string;
    description?: string;
    body?: string;
    author?: { name?: string };
    // All known engagement field variants across Apify actors
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    likesNumber?: number;
    commentsNumber?: number;
    sharesNumber?: number;
    numLikes?: number;
    numComments?: number;
    numShares?: number;
    reactionCount?: number;
    commentCount?: number;
    shareCount?: number;
    totalReactionCount?: number;
}

// ===== HELPER FUNCTIONS =====
function extractPostText(post: ApifyPost): string {
    const raw = post.text ?? post.postText ?? post.content ?? post.body ?? post.description ?? '';
    const text = (typeof raw === 'string' ? raw : String(raw)).trim().substring(0, 1500);
    return text;
}

function getMetric(post: ApifyPost, metric: 'likes' | 'comments' | 'shares'): number {
    switch (metric) {
        case 'likes':
            return post.likesCount ?? post.likesNumber ?? post.numLikes ?? post.reactionCount ?? post.totalReactionCount ?? 0;
        case 'comments':
            return post.commentsCount ?? post.commentsNumber ?? post.numComments ?? post.commentCount ?? 0;
        case 'shares':
            return post.sharesCount ?? post.sharesNumber ?? post.numShares ?? post.shareCount ?? 0;
    }
}

function filterSensitiveData(text: string): string {
    // Remove phone numbers (various formats)
    let filtered = text.replace(/(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, '[TELÉFONO]');
    // Remove WhatsApp numbers
    filtered = filtered.replace(/\(?WhatsApp\)?[\s]?[\d\s\-\(\)]+/gi, '[WHATSAPP]');
    // Remove email addresses
    filtered = filtered.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[EMAIL]');
    // Remove URLs
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

// ===== APIFY FUNCTIONS =====
async function searchLinkedInPosts(keywords: string[], maxPosts = 5): Promise<ApifyPost[]> {
    if (!apifyClient) { console.error("Apify token missing"); return []; }
    try {
        const run = await apifyClient.actor("buIWk2uOUzTmcLsuB").call({
            maxPosts, maxReactions: 1, scrapeComments: true, scrapeReactions: true,
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
    if (!apifyClient) { console.error("Apify token missing"); return []; }
    try {
        const run = await apifyClient.actor("A3cAPGpwBEG8RJwse").call({
            includeQuotePosts: true, includeReposts: true, maxComments: 5, maxPosts,
            maxReactions: 1, postedLimit: "week", scrapeComments: true, scrapeReactions: true,
            targetUrls: profileUrls
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        return items as ApifyPost[];
    } catch (error) {
        console.error("Apify Creator Posts Error:", error);
        return [];
    }
}

// ===== OPTIMIZED AI FUNCTIONS =====

// 1. QUERY EXPANSION
async function expandSearchQuery(topic: string): Promise<string[]> {
    if (!openai) return [topic];
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: "Eres un experto en boolean search." },
            { role: "user", content: `Transforma "${topic}" en 3 búsquedas booleanas para LinkedIn (JSON: {queries: []}).` }],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(response.choices[0].message.content || '{"queries": []}');
        const queries = Array.isArray(result.queries) ? result.queries : [topic];
        // Ensure all items are strings to prevent "q.trim is not a function" error in Apify
        return queries.filter((q: any) => typeof q === 'string' && q.trim().length > 0);
    } catch (e) { return [topic]; }
}

// 2. RELATIVE VIRALITY SCORING
async function evaluatePostEngagement(posts: ApifyPost[]): Promise<ApifyPost[]> {
    if (posts.length === 0) return [];
    if (!openai) return posts.slice(0, 5); // Fallback: return top posts if AI not available

    // Low floor to ensure we have candidates
    const meaningfulPosts = posts.filter(p => {
        const len = extractPostText(p).length;
        if (len < 50) return false; // Skip empty posts
        // Relaxed metric floor: even 1 like might be enough if it has comments?
        // Let's rely on ratio mostly, but ensure at least SOME engagement or it's dead
        const likes = getMetric(p, 'likes');
        const comments = getMetric(p, 'comments');
        return (likes + comments) > 2;
    });

    if (meaningfulPosts.length === 0) return posts.slice(0, 3); // Fallback to raw if logic filtered all

    const postsData = meaningfulPosts.slice(0, 15).map((p, idx) => ({
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
    if (!openai) return '{}';
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: "Extract viral structure JSON." }, { role: "user", content: content }],
            response_format: { type: "json_object" }
        });
        return response.choices[0].message.content || '{}';
    } catch { return '{}'; }
}

// 4. REWRITE
async function regeneratePost(structure: string, original: string, instructions: string): Promise<string> {
    if (!openai) return original;
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


// ===== ROUTER =====
const router = express.Router();

router.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.get('/creators', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from('creators').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/creators', requireAuth, async (req, res) => {
    const { name, linkedinUrl, headline } = req.body;
    const supabase = getUserSupabase(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase.from('creators')
        .insert({ user_id: user.id, name, linkedin_url: linkedinUrl, headline })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/creators/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const supabase = getUserSupabase(req);
    const { error } = await supabase.from('creators').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: 'deleted' });
});

router.get('/posts', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.patch('/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from('posts').update({ status }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const supabase = getUserSupabase(req);
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Post deleted successfully" });
});

router.post('/rewrite', requireAuth, async (req, res) => {
    const { text, profile, instruction } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

    // ... logic for rewrite ...
    // Simplified inline rewrite logic to avoid huge file size
    const tone = profile?.custom_instructions || "profesional";
    const prompt = `Reescribe: ${text} \n Instrucción: ${instruction} \n Tono: ${tone}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", messages: [{ role: "user", content: prompt }]
        });
        res.json({ result: response.choices[0].message.content });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ===== WORKFLOW LOGIC (EXTRACTED) =====
async function executeWorkflowGenerate(req: Request, res: Response) {
    req.setTimeout(60000); // 60s timeout
    const { source, count = 1 } = req.body;
    const supabase = getUserSupabase(req);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { data: profile } = await supabase.from('profiles').select('*').single();
        if (!profile) return res.status(400).json({ error: "Config needed." });

        const keywords = profile.niche_keywords || [];
        const customInstructions = profile.custom_instructions || '';
        let allPosts: ApifyPost[] = [];

        console.log('[WORKFLOW] Starting. Source:', source, 'Count:', count, 'Keywords:', keywords);

        // 1. FETCH
        if (source === 'keywords') {
            if (keywords.length === 0) return res.status(400).json({ error: "No keywords." });
            const activeKeywords = keywords.slice(0, 2);
            console.log('[WORKFLOW] Active keywords:', activeKeywords);
            const expandedLists = await Promise.all(activeKeywords.map((k: string) => expandSearchQuery(k)));
            console.log('[WORKFLOW] Expanded queries:', expandedLists);
            const rawQueries = [...new Set([...activeKeywords, ...expandedLists.flat()])];
            const searchQueries = rawQueries.filter(q => typeof q === 'string' && q.trim().length > 0).slice(0, 3);
            console.log('[WORKFLOW] Final search queries:', searchQueries);

            const results = await Promise.all(searchQueries.map(q => searchLinkedInPosts([q], 2)));
            allPosts = results.flat();
        } else {
            const { data: creators } = await supabase.from('creators').select('linkedin_url');
            if (!creators?.length) return res.status(400).json({ error: "No creators." });
            const urls = creators
                .map((c: any) => c.linkedin_url)
                .filter((u: any) => typeof u === 'string' && u.trim().length > 0)
                .slice(0, 5);

            if (urls.length === 0) return res.status(400).json({ error: "No valid creator URLs." });
            allPosts = await getCreatorPosts(urls, 5);
        }

        console.log('[WORKFLOW] Total posts fetched:', allPosts.length);
        // Log first post's raw keys to diagnose field name mismatches
        if (allPosts.length > 0) {
            const sample = allPosts[0];
            console.log('[WORKFLOW] Sample post keys:', Object.keys(sample));
            console.log('[WORKFLOW] Sample post text fields:', { text: sample.text?.substring(0, 50), postText: sample.postText?.substring(0, 50), content: sample.content?.substring(0, 50), body: sample.body?.substring(0, 50) });
            console.log('[WORKFLOW] Sample post metrics:', { likesCount: sample.likesCount, numLikes: sample.numLikes, commentsCount: sample.commentsCount, numComments: sample.numComments, reactionCount: sample.reactionCount, totalReactionCount: sample.totalReactionCount });
            console.log('[WORKFLOW] extractPostText result:', extractPostText(sample).substring(0, 100));
            console.log('[WORKFLOW] getMetric likes:', getMetric(sample, 'likes'), 'comments:', getMetric(sample, 'comments'));
        }

        // 2. ANALYZE
        const bestPosts = await evaluatePostEngagement(allPosts);
        console.log('[WORKFLOW] Best posts after evaluation:', bestPosts.length);

        if (bestPosts.length === 0) {
            console.log('[WORKFLOW] No posts survived evaluation! Returning empty.');
            return res.json({ status: 'success', data: [], message: "No suitable posts found. Try different keywords." });
        }

        // 3. GENERATE
        const postsToProcess = bestPosts.slice(0, count);
        console.log('[WORKFLOW] Processing', postsToProcess.length, 'posts');
        const generatedResults = await Promise.all(postsToProcess.map(async (post, idx) => {
            const postText = extractPostText(post);
            console.log(`[WORKFLOW] Post ${idx}: text length=${postText.length}`);
            if (!postText) return null;

            const filtered = filterSensitiveData(postText);
            const structure = await extractPostStructure(filtered);
            console.log(`[WORKFLOW] Post ${idx}: structure extracted`);
            const rewritten = await regeneratePost(structure, filtered, customInstructions);
            console.log(`[WORKFLOW] Post ${idx}: rewritten (${rewritten.length} chars)`);

            const postUrl = post.url || post.postUrl || '';
            const insertResult = await supabase.from('posts').insert({
                user_id: user.id,
                original_content: postText,
                generated_content: rewritten,
                type: source === 'keywords' ? 'research' : 'parasite',
                status: 'idea',
                meta: { structure, original_url: postUrl, engagement: { likes: getMetric(post, 'likes'), comments: getMetric(post, 'comments') } }
            });
            if (insertResult.error) console.error(`[WORKFLOW] Post ${idx}: DB insert error:`, insertResult.error);
            else console.log(`[WORKFLOW] Post ${idx}: saved to DB`);

            return { original: postText.substring(0, 100) + '...', generated: rewritten, sourceUrl: postUrl };
        }));

        const validResults = generatedResults.filter(Boolean);
        console.log('[WORKFLOW] Done!', validResults.length, 'posts generated successfully');
        res.json({ status: 'success', data: validResults, message: `${validResults.length} posts generated` });

    } catch (error: any) {
        console.error("[WORKFLOW] FATAL ERROR:", error);
        res.status(500).json({ error: error.message });
    }
}

router.post('/workflow/generate', requireAuth, executeWorkflowGenerate);

// Legacy support - call the shared workflow function
router.post('/workflow/parasite', requireAuth, async (req, res) => {
    req.body.source = 'creators';
    req.body.count = req.body.count || 1;
    return executeWorkflowGenerate(req, res);
});

router.post('/workflow/research', requireAuth, async (req, res) => {
    req.body.source = 'keywords';
    req.body.count = req.body.count || 1;
    return executeWorkflowGenerate(req, res);
});


// Mount router on both /api and / to handle Vercel path variations
app.use('/api', router);
app.use('/', router);

// ===== VERCEL HANDLER =====
export default app;

