import express, { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, getSupabaseUserClient } from './db';
import { getCreatorPosts, searchLinkedInPosts, searchGoogleNews } from './services/apifyService';
import { generatePostOutline, regeneratePost, generateIdeasFromResearch, evaluatePostEngagement, expandSearchQuery, extractPostStructure } from './services/openaiService';
import { getScheduleConfigs, saveScheduleConfig, startScheduleJob, stopScheduleJob } from './services/schedulerService';

const router = express.Router();

// ===== TABLES =====
const TABLE_PROFILES = process.env.TABLE_PROFILES;
const TABLE_POSTS = process.env.TABLE_POSTS;
const TABLE_CREATORS = process.env.TABLE_CREATORS;

if (!TABLE_PROFILES || !TABLE_POSTS || !TABLE_CREATORS) {
    console.error(`[FATAL] TABLE_VARS_MISSING_SERVER: PROF=${TABLE_PROFILES}, POST=${TABLE_POSTS}, CREAT=${TABLE_CREATORS}`);
}

/**
 * Middleware to extract Bearer Token
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Invalid token format' });
        return;
    }
    (req as any).token = token;
    next();
};

// Interfaces
interface ApifyPost {
    id?: string;
    url?: string;
    postUrl?: string;
    socialUrl?: string;
    text?: string;
    postText?: string;
    content?: string;
    description?: string;
    author?: {
        name?: string;
    };
    authorName?: string;
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    likesNumber?: number;
    commentsNumber?: number;
    sharesNumber?: number;
    reactionCount?: number;
    likes?: number;
    comments?: number;
    shares?: number;
}

interface CreateCreatorRequest {
    name: string;
    linkedinUrl: string;
    headline?: string;
}

interface ResearchRequest {
    topic: string;
}

/**
 * HELPER FUNCTIONS
 */
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
    filtered = filtered.replace(/(?:Rua|Avenida|Av\.|Calle|Street|Rute|nº|Número|Loja|Edifício|Moçambique|Portugal|Brasil|España|México|Argentina|Clínica|Shopping|Centro Comercial|Piso|Andar)\s+[^\.]*\.?/gi, (match) => {
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

/**
 * HELPERS
 */
const getUserSupabase = (req: Request) => {
    const token = (req as any).token;
    return getSupabaseUserClient(token);
};

/**
 * CREATORS - Management (Protected)
 */
router.get('/creators', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase.from(TABLE_CREATORS).select('*');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/creators', requireAuth, async (req, res) => {
    const { name, linkedinUrl, headline } = req.body;
    const supabase = getUserSupabase(req);

    // Get User ID (handled by RLS automatically on insert, but we need to ensure session exists)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
        .from(TABLE_CREATORS)
        .insert({
            user_id: user.id,
            name,
            linkedin_url: linkedinUrl,
            headline
        })
        .select() // Return the inserted row
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

/**
 * WORKFLOW 1: VIRAL POST REPLICATION (Parasite)
 */
router.post('/workflow/parasite', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);

    // Get User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    try {
        // Step 1: Get creators
        const { data: creators, error: creatorError } = await supabase.from(TABLE_CREATORS).select('linkedin_url');
        if (creatorError) throw creatorError;

        if (!creators || creators.length === 0) {
            res.status(400).json({ error: "No creators found." });
            return;
        }

        const creatorUrls = creators.map((c: any) => c.linkedin_url);

        // Step 2: Scrape Posts
        console.log(`Scraping posts for ${creatorUrls.length} creators...`);
        const rawPosts = await getCreatorPosts(creatorUrls, 10) as ApifyPost[];

        // Filter by Engagement (e.g., > 10 reactions)
        const ENGAGEMENT_THRESHOLD = 5;
        const highEngagementPosts = rawPosts.filter(p => (p.likesCount || 0) + (p.commentsCount || 0) > ENGAGEMENT_THRESHOLD);

        console.log(`Filtered ${rawPosts.length} posts to ${highEngagementPosts.length} high-engagement posts.`);

        const processedPosts = [];

        // Step 3: Get User Profile (custom_instructions for tone of voice)
        const { data: profile } = await supabase.from(TABLE_PROFILES).select('*').single();
        const customInstructions = profile?.custom_instructions || '';

        for (const post of highEngagementPosts) {
            const postText = extractPostText(post);
            if (!postText) continue;

            // Generate Outline
            const outline = await generatePostOutline(postText);

            // Regenerate Content using custom_instructions as master prompt
            const rewritten = await regeneratePost(outline || '', postText, customInstructions);

            // Save to DB
            await supabase.from(TABLE_POSTS).insert({
                user_id: user.id,
                original_post_id: post.id || 'unknown',
                original_url: post.url || '',
                original_content: postText,
                original_author: post.author?.name || 'Unknown',
                generated_content: rewritten,
                type: 'parasite',
                meta: {
                    outline,
                    engagement: {
                        likes: getMetric(post, 'likes'),
                        comments: getMetric(post, 'comments'),
                        shares: getMetric(post, 'shares')
                    }
                }
            });

            processedPosts.push({
                original: postText,
                generated: rewritten,
                outline: outline
            });
        }

        res.json({ status: 'success', data: processedPosts });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message || "Workflow failed" });
    }
});

/**
 * WORKFLOW 2: AUTOMATED CONTENT RESEARCH
 */
router.post('/workflow/research', requireAuth, async (req, res) => {
    const { topic } = req.body;
    if (!topic) {
        res.status(400).json({ error: "Topic is required" });
        return;
    }

    const supabase = getUserSupabase(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    try {
        // Step 1: Search LinkedIn
        console.log(`Searching LinkedIn for: ${topic}`);
        const linkedInPosts = await searchLinkedInPosts([topic], 5) as ApifyPost[];

        const results = [];

        for (const post of linkedInPosts) {
            const postText = extractPostText(post);
            if (!postText) continue;

            // Step 2: Deep Research
            const news = await searchGoogleNews([topic], 3);

            // Step 3: Ideas
            const ideas = await generateIdeasFromResearch(postText, news);

            // Save Research
            await supabase.from(TABLE_POSTS).insert({
                user_id: user.id,
                original_content: postText, // The "Search Result"
                type: 'research',
                meta: { news, ideas }
            });

            results.push({
                sourcePost: postText,
                research: news,
                ideas: ideas
            });
        }

        res.json({ status: 'success', data: results });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message || "Research failed" });
    }
});

/**
 * CRON: Scheduled Research (Admin/Service Role)
 */
router.post('/cron/research', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const topics = ["Inteligencia Artificial", "Growth Marketing", "Emprendimiento"];
        console.log(`[CRON] Starting scheduled research...`);

        // We need a user to assign these posts to. 
        // For now, we might need a "System User" or loop through all active users (complex).
        // Simplification: We'll store them for a specific Admin User ID or just leave user_id NULL if schema allows
        // But schema says NOT NULL. 
        // Strategy: Get all users with 'research_enabled' flag? 
        // For this MVP: Fetch first user or specific ID from env.

        // Fallback: This cron logic needs refinement for Multi-tenancy.
        // We will just Log for now.
        console.log("Cron executed. Multi-tenant cron pending implementation.");

        res.json({ status: 'success', message: "Cron executed (Dry Run)" });

    } catch (error) {
        console.error("[CRON] Error:", error);
        res.status(500).json({ error: "Cron job failed" });
    }
});

/**
 * GENERAL: Get Generated Posts
 */
router.get('/posts', requireAuth, async (req, res) => {
    const supabase = getUserSupabase(req);
    const { data, error } = await supabase
        .from(TABLE_POSTS!)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

/**
 * UPDATE STATUS
 */
router.patch('/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const supabase = getUserSupabase(req);

    if (!['idea', 'drafted', 'approved', 'posted'].includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
    }

    const { data, error } = await supabase.from(TABLE_POSTS)
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

/**
 * DELETE POST
 */
router.delete('/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const supabase = getUserSupabase(req);

    const { error } = await supabase
        .from(TABLE_POSTS)
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Post deleted successfully" });
});

/**
 * UNIFIED WORKFLOW: Generate content using profile settings
 * Uses keywords OR creators from profile (no popup needed)
 * Implements AI-based engagement evaluation
 */
router.post('/workflow/generate', requireAuth, async (req, res) => {
    const { source, count = 3 } = req.body; // 'keywords' or 'creators', default 3 posts

    const supabase = getUserSupabase(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    try {
        // Step 1: Get User Profile with settings
        const { data: profile } = await supabase.from(TABLE_PROFILES).select('*').single();
        if (!profile) {
            res.status(400).json({ error: "Profile not found. Configure your settings first." });
            return;
        }

        const keywords = profile.niche_keywords || [];
        const customInstructions = profile.custom_instructions || '';

        let allPosts: ApifyPost[] = [];

        console.log(`[WORKFLOW] Starting generation for ${count} posts...`);

        if (source === 'keywords') {
            console.log(`Processing keywords: ${keywords.join(', ')}`);

            if (keywords.length === 0) {
                res.status(400).json({ error: "No keywords configured. Add keywords in Settings." });
                return;
            }

            // 1. IMPROVED INPUT: Use AI to expand queries
            let expandedQueries: string[] = [];
            for (const keyword of keywords.slice(0, 3)) { // Limit to top 3 keywords to avoid timeout
                // Detect if it's already a complex query or just a generic term
                if (keyword.includes('"') || keyword.includes('AND')) {
                    expandedQueries.push(keyword);
                } else {
                    const expansion = await expandSearchQuery(keyword);
                    expandedQueries = [...expandedQueries, ...expansion];
                }
            }

            // Deduplicate
            expandedQueries = [...new Set(expandedQueries)];
            console.log(`Expanded ${keywords.length} keywords into ${expandedQueries.length} intent-based queries:`, expandedQueries);

            // Search for each expanded query
            // We fetch less per query because we have more queries now
            const postsPerQuery = 2;
            for (const query of expandedQueries.slice(0, 5)) { // Limit to 5 queries total for performance
                const posts = await searchLinkedInPosts([query], postsPerQuery) as ApifyPost[];
                allPosts = [...allPosts, ...posts];
            }
        } else {
            // Get posts from monitored creators
            const { data: creators } = await supabase.from(TABLE_CREATORS).select('linkedin_url');

            if (!creators || creators.length === 0) {
                res.status(400).json({ error: "No creators configured. Add creators in Settings." });
                return;
            }

            const creatorUrls = creators.map((c: any) => c.linkedin_url);
            console.log(`Scraping posts from ${creatorUrls.length} creators...`);
            // Fetch more posts to ensure we get the requested count
            allPosts = await getCreatorPosts(creatorUrls, count + 5) as ApifyPost[];
        }

        console.log(`Fetched ${allPosts.length} total posts, need ${count}`);

        // Remove duplicates by ID or approx text match
        const uniquePostsMap = new Map();
        allPosts.forEach(p => {
            const key = p.url || p.postUrl || p.text?.substring(0, 50);
            if (key && !uniquePostsMap.has(key)) {
                uniquePostsMap.set(key, p);
            }
        });
        const uniquePosts = Array.from(uniquePostsMap.values());

        // Step 2: RELATIVE VIRALITY SCORING (The Sniffer)
        // This function now uses the Improved Logic (Ratios)
        const highEngagementPosts = await evaluatePostEngagement(uniquePosts);
        console.log(`AI selected ${highEngagementPosts.length} high-engagement posts (Hidden Gems)`);

        if (highEngagementPosts.length === 0) {
            res.json({ status: 'success', data: [], message: "No high-engagement posts found" });
            return;
        }

        // Step 3: Process each post (The Architect + The Writer)
        const processedPosts = [];

        for (const post of highEngagementPosts) {
            // Stop if we've reached the requested count
            if (processedPosts.length >= count) {
                console.log(`Reached target count of ${count} posts`);
                break;
            }

            // Extract content using robust helper function
            const postContent = extractPostText(post);

            if (!postContent) {
                console.log(`Skipping post ID ${post.id} due to missing content.`);
                continue;
            }

            // Filter sensitive data before processing
            const filteredContent = filterSensitiveData(postContent);

            // 3. THE ARCHITECT: Extract Structural DNA
            const structureJson = await extractPostStructure(filteredContent);

            // 4. THE WRITER: Fill the structure
            const rewritten = await regeneratePost(structureJson || '', filteredContent, customInstructions);

            // Save to DB
            const { error: insertError } = await supabase.from(TABLE_POSTS).insert({
                user_id: user.id,
                original_post_id: post.id || 'unknown',
                original_url: post.url || post.postUrl || post.socialUrl || '',
                original_content: postContent,
                original_author: post.author?.name || post.authorName || 'Unknown',
                generated_content: rewritten,
                type: source === 'keywords' ? 'research' : 'parasite',
                status: 'idea',
                meta: {
                    structure: structureJson, // Save structure for debugging/future use
                    original_url: post.url || post.postUrl || null,
                    engagement: {
                        likes: getMetric(post, 'likes'),
                        comments: getMetric(post, 'comments'),
                        shares: getMetric(post, 'shares')
                    },
                    raw_debug: post
                }
            });

            if (insertError) {
                console.error("Supabase Insert Error:", insertError);
            } else {
                console.log("Post saved to DB successfully.");
            }

            processedPosts.push({
                original: postContent.substring(0, 200) + '...',
                generated: rewritten,
                sourceUrl: post.url || post.postUrl || '',
                engagement: {
                    likes: getMetric(post, 'likes'),
                    comments: getMetric(post, 'comments'),
                    shares: getMetric(post, 'shares')
                }
            });
        }

        console.log(`Successfully generated ${processedPosts.length}/${count} posts`);
        res.json({
            status: 'success',
            source,
            postsProcessed: processedPosts.length,
            data: processedPosts,
            message: `${processedPosts.length} posts successfully generated`
        });

    } catch (error: any) {
        console.error("Generate workflow error:", error);
        res.status(500).json({ error: error.message || "Workflow failed" });
    }
});

// ============================================
// 🔔 SCHEDULE / AUTOPILOT ROUTES
// ============================================

/**
 * GET - Obtener configuración del schedule del usuario
 */
router.get('/schedule', requireAuth, async (req: Request, res: Response) => {
    try {
        const { data: { user }, error: userError } = await getSupabaseUserClient(
            (req as any).token
        ).auth.getUser();

        if (userError || !user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const schedules = await getScheduleConfigs(user.id);
        const schedule = schedules.length > 0 ? schedules[0] : null;

        res.json({
            status: 'success',
            schedule
        });
    } catch (error) {
        console.error('Error getting schedule:', error);
        res.status(500).json({ error: 'Failed to get schedule' });
    }
});

/**
 * POST - Crear o actualizar schedule
 */
router.post('/schedule', requireAuth, async (req: Request, res: Response) => {
    try {
        const { data: { user }, error: userError } = await getSupabaseUserClient(
            (req as any).token
        ).auth.getUser();

        if (userError || !user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { enabled, time, timezone, source, count } = req.body;

        // Validar inputs
        if (!time || !source || count === undefined) {
            res.status(400).json({ error: 'Missing required fields: time, source, count' });
            return;
        }

        if (!/^\d{2}:\d{2}$/.test(time)) {
            res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
            return;
        }

        if (!['keywords', 'creators'].includes(source)) {
            res.status(400).json({ error: 'Source must be "keywords" or "creators"' });
            return;
        }

        const scheduleConfig = await saveScheduleConfig(user.id, {
            enabled: enabled !== false,
            time,
            timezone: timezone || 'Europe/Madrid',
            source,
            count: Math.max(1, Math.min(count, 20))
        });

        if (!scheduleConfig) {
            res.status(500).json({ error: 'Failed to save schedule' });
            return;
        }

        // Iniciar o detener el job
        if (scheduleConfig.enabled) {
            startScheduleJob(scheduleConfig);
        } else {
            stopScheduleJob(scheduleConfig.id!, user.id);
        }

        res.json({
            status: 'success',
            message: `Schedule ${scheduleConfig.enabled ? 'enabled' : 'disabled'}`,
            schedule: scheduleConfig
        });
    } catch (error: any) {
        console.error('Error saving schedule:', error);
        res.status(500).json({ error: error.message || 'Failed to save schedule' });
    }
});

/**
 * PUT - Toggle schedule on/off
 */
router.put('/schedule/toggle', requireAuth, async (req: Request, res: Response) => {
    try {
        const { data: { user }, error: userError } = await getSupabaseUserClient(
            (req as any).token
        ).auth.getUser();

        if (userError || !user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const schedules = await getScheduleConfigs(user.id);
        if (!schedules[0]) {
            res.status(404).json({ error: 'No schedule found' });
            return;
        }

        const currentSchedule = schedules[0];
        const updatedSchedule = await saveScheduleConfig(user.id, {
            enabled: !currentSchedule.enabled,
            time: currentSchedule.time,
            timezone: currentSchedule.timezone,
            source: currentSchedule.source,
            count: currentSchedule.count
        });

        if (!updatedSchedule) {
            res.status(500).json({ error: 'Failed to toggle schedule' });
            return;
        }

        // Actualizar job
        stopScheduleJob(updatedSchedule.id!, user.id);
        if (updatedSchedule.enabled) {
            startScheduleJob(updatedSchedule);
        }

        res.json({
            status: 'success',
            message: `Schedule ${updatedSchedule.enabled ? 'enabled' : 'disabled'}`,
            schedule: updatedSchedule
        });
    } catch (error) {
        console.error('Error toggling schedule:', error);
        res.status(500).json({ error: 'Failed to toggle schedule' });
    }
});

/**
 * GET - Obtener historial de ejecuciones del schedule
 */
router.get('/schedule/executions', requireAuth, async (req: Request, res: Response) => {
    try {
        const { data: { user }, error: userError } = await getSupabaseUserClient(
            (req as any).token
        ).auth.getUser();

        if (userError || !user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { data: executions, error } = await supabaseAdmin
            .from('schedule_executions')
            .select('*')
            .eq('user_id', user.id)
            .order('executed_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({
            status: 'success',
            executions: executions || []
        });
    } catch (error) {
        console.error('Error getting executions:', error);
        res.status(500).json({ error: 'Failed to get executions' });
    }
});

export default router;
