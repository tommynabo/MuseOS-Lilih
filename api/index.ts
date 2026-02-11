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
    postUrl?: string; // Some actors return this
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
    ).trim().substring(0, 1500); // Increased limit slightly to capture more context
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

        // 1. FETCH
        if (source === 'keywords') {
            if (keywords.length === 0) return res.status(400).json({ error: "No keywords." });
            const activeKeywords = keywords.slice(0, 2); // Top 2
            const expandedLists = await Promise.all(activeKeywords.map((k: string) => expandSearchQuery(k)));
            // Fallback: make sure we have at least the original keyword if expansion returned nothing useful
            const searchQueries = [...new Set([...activeKeywords, ...expandedLists.flat()])].slice(0, 3);

            const results = await Promise.all(searchQueries.map(q => searchLinkedInPosts([q], 2)));
            allPosts = results.flat();
        } else {
            const { data: creators } = await supabase.from('creators').select('linkedin_url');
            if (!creators?.length) return res.status(400).json({ error: "No creators." });
            const urls = creators.slice(0, 5).map((c: any) => c.linkedin_url);
            allPosts = await getCreatorPosts(urls, 5);
        }

        // 2. ANALYZE
        const bestPosts = await evaluatePostEngagement(allPosts);

        if (bestPosts.length === 0) {
            return res.json({ status: 'success', data: [], message: "No suitable posts found. Try different keywords." });
        }

        // 3. GENERATE
        const postsToProcess = bestPosts.slice(0, count);
        const generatedResults = await Promise.all(postsToProcess.map(async (post) => {
            const postText = extractPostText(post);
            if (!postText) return null;

            const filtered = filterSensitiveData(postText);
            const structure = await extractPostStructure(filtered);
            const rewritten = await regeneratePost(structure, filtered, customInstructions);

            await supabase.from('posts').insert({
                user_id: user.id,
                original_content: postText,
                generated_content: rewritten,
                type: source === 'keywords' ? 'research' : 'parasite',
                status: 'idea',
                meta: { structure, original_url: post.url, engagement: { likes: getMetric(post, 'likes'), comments: getMetric(post, 'comments') } }
            });

            return { original: postText.substring(0, 100) + '...', generated: rewritten, sourceUrl: post.url };
        }));

        const validResults = generatedResults.filter(Boolean);
        res.json({ status: 'success', data: validResults, message: `${validResults.length} posts generated` });

    } catch (error: any) {
        console.error("Workflow error:", error);
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


// ===== MOUNT =====
// Mount router - Vercel will handle the /api prefix
app.use('/', router);

// ===== VERCEL HANDLER =====
// Vercel automatically wraps Express apps, just export the app
export default app;
