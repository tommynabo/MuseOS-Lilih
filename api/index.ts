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
    switch(metric) {
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
async function evaluatePostEngagement(posts: ApifyPost[]): Promise<ApifyPost[]> {
    if (posts.length === 0) return [];

    console.log(`Evaluating ${posts.length} posts for engagement...`);

    const postsData = posts.map((p, idx) => ({
        index: idx,
        text: extractPostText(p),
        likes: getMetric(p, 'likes'),
        comments: getMetric(p, 'comments'),
        shares: getMetric(p, 'shares')
    }));

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Eres un experto en métricas de redes sociales." },
                {
                    role: "user", content: `Analiza estos posts y devuelve los índices de los 5 mejores basados en engagement (likes, comments, shares).
                ${JSON.stringify(postsData)}
                Responde JSON puramente: { "indices": [0, 2, 4] }` }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content || '{"indices": []}';
        console.log("AI Evaluation result:", content);

        const result = JSON.parse(content);
        const selectedIndices = result.indices || [];

        let selectedPosts = selectedIndices
            .map((i: number) => posts[i])
            .filter(p => p && extractPostText(p).length > 0);

        // FALLBACK: If AI selects fewer than 2 posts, fill up with top sorted posts
        if (selectedPosts.length < 2) {
            console.log("AI selected too few posts, using fallback sorting.");
            const sorted = [...posts]
                .filter(p => extractPostText(p).length > 0)
                .sort((a, b) => {
                    const scoreA = getMetric(a, 'likes') + getMetric(a, 'comments') * 2 + getMetric(a, 'shares') * 3;
                    const scoreB = getMetric(b, 'likes') + getMetric(b, 'comments') * 2 + getMetric(b, 'shares') * 3;
                    return scoreB - scoreA;
                });
            
            // Deduplicate by URL
            const existingIds = new Set(selectedPosts.map(p => p.url).filter(Boolean));
            for (const p of sorted) {
                if (selectedPosts.length >= 5) break;
                if (!existingIds.has(p.url)) {
                    selectedPosts.push(p);
                    existingIds.add(p.url);
                }
            }
        }

        const finalSelection = selectedPosts.slice(0, 5);
        console.log(`Selected ${finalSelection.length} posts for processing`);
        return finalSelection;
    } catch (error) {
        console.error("Engagement evaluation error (using fallback):", error);
        // Ultimate fallback: just sort by engagement metrics
        return posts
            .filter(p => extractPostText(p).length > 0)
            .sort((a, b) => {
                const scoreA = getMetric(a, 'likes') + getMetric(a, 'comments') * 2;
                const scoreB = getMetric(b, 'likes') + getMetric(b, 'comments') * 2;
                return scoreB - scoreA;
            })
            .slice(0, 5);
    }
}

async function generatePostOutline(content: string): Promise<string> {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: "Actúa como un Estratega de Contenido Viral." },
            { role: "user", content: `Crea un outline estratégico para este post de LinkedIn:\n${content}\n\nDevuelve: ANÁLISIS, HOOKS (3), CUERPO (4 puntos), CIERRE` }
        ]
    });
    return response.choices[0].message.content || '';
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
    
    // Remove physical addresses (look for patterns like "Rua", "Avenida", "Av.", etc.)
    filtered = filtered.replace(/(?:Rua|Avenida|Av\.|Calle|Street|Rua|Rute|nº|Número|Loja|Edifício|Moçambique|Portugal|Brasil|España|México|Argentina)\s+[^\.]*\.?/gi, (match) => {
        // Only remove if it looks like an address (contains numbers)
        if (/\d/.test(match)) {
            return '[DIRECCIÓN]';
        }
        return match;
    });
    
    // Remove geographic coordinates and specific location identifiers
    filtered = filtered.replace(/📍\s*[^[\n]*/gi, '[UBICACIÓN]');
    filtered = filtered.replace(/Maputo|Lisboa|Porto|Rio de Janeiro|São Paulo/gi, '[CIUDAD]');
    
    return filtered.trim();
}

async function regeneratePost(outline: string, original: string, customInstructions: string): Promise<string> {
    const systemPrompt = customInstructions || "Eres un redactor experto en Ghostwriting. Párrafos cortos. Sin emojis. Tutea.";
    const filteredOriginal = filterSensitiveData(original);
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: `${systemPrompt}\n\nIMPORTANTE: Nunca incluyas en el post generado:\n- Números de teléfono\n- Emails\n- URLs o direcciones web\n- Direcciones físicas\n- Información de contacto\n- Datos personales o de ubicación específica` },
            { role: "user", content: `Reescribe este post basándote en el outline:\n[OUTLINE]: ${outline}\n[ORIGINAL]: ${filteredOriginal}\n\nGenera el post final SIN incluir datos de contacto.` }
        ]
    });
    return response.choices[0].message.content || '';
}

// ===== ROUTES =====
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/api/creators', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from('creators').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/creators', requireAuth, async (req, res) => {
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

app.delete('/api/creators/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const supabase = getUserSupabase(req);
    const { error } = await supabase.from('creators').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: 'deleted' });
});

app.get('/api/posts', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.patch('/api/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const supabase = getUserSupabase(req);
    
    if (!['idea', 'drafted', 'approved', 'posted'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    const { data, error } = await supabase.from('posts')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ===== MAIN WORKFLOW =====
app.post('/api/workflow/generate', requireAuth, async (req, res) => {
    const { source, count = 3 } = req.body; // 'keywords' or 'creators', default 3 posts
    const supabase = getUserSupabase(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { data: profile } = await supabase.from('profiles').select('*').single();
        if (!profile) return res.status(400).json({ error: "Configure settings first." });

        const keywords = profile.niche_keywords || [];
        const customInstructions = profile.custom_instructions || '';
        let allPosts: ApifyPost[] = [];

        console.log(`[WORKFLOW] Starting generation for ${count} posts...`);

        if (source === 'keywords') {
            if (keywords.length === 0) return res.status(400).json({ error: "No keywords configured." });
            // Fetch more posts to ensure we get the requested count
            const postsPerKeyword = Math.ceil(count / keywords.length) + 2;
            for (const kw of keywords.slice(0, 5)) {
                allPosts = [...allPosts, ...await searchLinkedInPosts([kw], postsPerKeyword)];
            }
        } else {
            const { data: creators } = await supabase.from('creators').select('linkedin_url');
            if (!creators?.length) return res.status(400).json({ error: "No creators configured." });
            // Fetch more posts to ensure we get the requested count
            allPosts = await getCreatorPosts(creators.map((c: any) => c.linkedin_url), count + 5);
        }

        console.log(`Fetched ${allPosts.length} posts, need ${count}`);
        const highEngagement = await evaluatePostEngagement(allPosts);
        console.log(`Selected ${highEngagement.length} high-engagement posts from evaluation`);

        if (highEngagement.length === 0) return res.json({ status: 'success', data: [], message: "No posts with sufficient text content found" });

        const results = [];
        for (const post of highEngagement) {
            // Stop if we've reached the requested count
            if (results.length >= count) {
                console.log(`Reached target count of ${count} posts`);
                break;
            }

            const postText = extractPostText(post);
            if (!postText) {
                console.warn("Skipping post with no text:", post.url || post.id);
                continue;
            }

            try {
                const outline = await generatePostOutline(postText);
                const rewritten = await regeneratePost(outline, postText, customInstructions);

                const inserted = await supabase.from('posts').insert({
                    user_id: user.id,
                    original_content: postText,
                    generated_content: rewritten,
                    type: source === 'keywords' ? 'research' : 'parasite',
                    status: 'drafted',
                    meta: {
                        outline,
                        original_url: post.url || null,
                        engagement: {
                            likes: getMetric(post, 'likes'),
                            comments: getMetric(post, 'comments'),
                            shares: getMetric(post, 'shares')
                        }
                    }
                }).select().single();

                if (inserted.error) {
                    console.error("Error inserting post:", inserted.error);
                    continue;
                }

                results.push({
                    original: postText.substring(0, 200) + '...',
                    generated: rewritten.substring(0, 300) + '...',
                    sourceUrl: post.url
                });
            } catch (postError: any) {
                console.error("Error processing post:", postError);
                continue;
            }
        }

        console.log(`Successfully generated ${results.length}/${count} posts`);
        res.json({
            status: 'success',
            postsProcessed: results.length,
            data: results,
            message: `${results.length} posts successfully generated`
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
