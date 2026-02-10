import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI-based engagement evaluation
 * Considers likes, comments, shares holistically
 */
export const evaluatePostEngagement = async (posts: any[]): Promise<any[]> => {
    if (posts.length === 0) return [];

    const postsData = posts.map((p, idx) => ({
        index: idx,
        // Robust text extraction
        text: (p.text || p.postText || p.content || p.description || '').substring(0, 500),
        // Robust metrics extraction
        likes: p.likesCount || p.likesNumber || p.likes || p.reactionCount || 0,
        comments: p.commentsCount || p.commentsNumber || p.comments || 0,
        shares: p.sharesCount || p.sharesNumber || p.shares || 0
    }));

    // DEBUG LOG
    if (posts.length > 0) {
        console.log("OpenAI Service - First Post Input Keys:", Object.keys(posts[0]));
        console.log("OpenAI Service - Mapped Data Sample:", postsData[0]);
    }

    const prompt = `
    Analiza estos posts de LinkedIn y determina cuáles tienen ALTO ENGAGEMENT.
    Un post con alto engagement puede tener:
    - Muchos likes (>50)
    - O muchos comentarios (>10)
    - O muchos shares (>5)
    - O una combinación que indica viralidad (ej: 60 likes + 40 shares + 100 comentarios = MUY ALTO)

    POSTS:
    ${JSON.stringify(postsData, null, 2)}

    Devuelve un JSON con los índices de los posts con alto engagement (máximo 5):
    { "high_engagement_indices": [0, 2, 4] }

    Si ninguno tiene alto engagement, devuelve: { "high_engagement_indices": [] }
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Eres un experto en métricas de redes sociales." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content || '{"high_engagement_indices": []}');
        let indices = result.high_engagement_indices || [];

        // FALLBACK: If AI finds no high-engagement posts, strictly select top 5 by metrics
        if (indices.length === 0) {
            console.log("AI selected 0 posts. Using fallback sorting.");
            return posts
                .sort((a, b) => {
                    const scoreA = (a.likesCount || 0) + (a.commentsCount || 0) * 2;
                    const scoreB = (b.likesCount || 0) + (b.commentsCount || 0) * 2;
                    return scoreB - scoreA;
                })
                .slice(0, 5);
        }

        return indices.map((i: number) => posts[i]).filter(Boolean).slice(0, 5);
    } catch (error) {
        console.error("Engagement evaluation error:", error);
        // Fallback on error
        return posts
            .sort((a, b) => ((b.likesCount || 0) + (b.commentsCount || 0)) - ((a.likesCount || 0) + (a.commentsCount || 0)))
            .slice(0, 5);
    }
};

export const generatePostOutline = async (originalContent: string) => {
    const prompt = `Analiza el siguiente contenido y crea un esquema (Outline) estratégico para un post de LinkedIn.
    
    INPUT:
    ${originalContent}
    
    Salida esperada (Markdown):
    ---
    ANÁLISIS: (Resumen en 1 frase)
    HOOKS: (3 opciones: Agresivo, Historia, Dato)
    CUERPO: (4 puntos clave)
    CIERRE: (Frase final)
    ---
    `;

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "Actúa como un Estratega de Contenido Viral." }, { role: "user", content: prompt }],
    });

    return response.choices[0].message.content;
};

/**
 * Rewrite post using the master prompt (custom_instructions) from profile
 */
export const regeneratePost = async (outline: string, originalContent: string, customInstructions: string) => {
    const systemPrompt = customInstructions || `
    Eres un redactor experto en Ghostwriting para LinkedIn.
    - Escribe de forma directa y contundente
    - Usa párrafos cortos
    - Sin emojis
    - Tutea al lector
    - IMPORTANTE: ELIMINA CUALQUIER DATO DE CONTACTO (teléfonos, emails, direcciones físicas, URLs, CTAs de agendar llamada).
    - El objetivo es generar curiosidad y autoridad, no vender directamente.
    `;

    const prompt = `
    Reescribe este contenido para LinkedIn basándote en el outline.
    Mantén la esencia pero adáptalo a MI voz.
    
    [OUTLINE]:
    ${outline}
    
    [TEXTO_ORIGINAL]:
    ${originalContent}
    
    Genera el post final listo para publicar.
    `;

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ],
    });

    return response.choices[0].message.content;
};

export const generateViralityAnalysis = async (postContent: string, originalMetrics?: { likes: number; comments: number }) => {
    const prompt = `
    Eres un experto en análisis de viralidad de contenido en LinkedIn. Analiza este post profesionalmente.
    
    CONTENIDO:
    "${postContent}"
    
    MÉTRICAS ORIGINALES (si las hay): ${originalMetrics ? `${originalMetrics.likes} likes, ${originalMetrics.comments} comentarios` : 'No disponibles'}
    
    Proporciona un análisis profesional en JSON con EXACTAMENTE estos campos (sin símbolos ### ni markdown):
    {
      "viralityReason": "string - Explicación concisa de por qué este post podría volverse viral (máximo 150 caracteres)",
      "bottleneck": "string - Qué limita el alcance de este post (máximo 150 caracteres)",
      "engagement_trigger": "string - Qué elemento específico genera comentarios/shares (máximo 150 caracteres)",
      "audience_relevance": "string - A qué audiencia le importa más este contenido (máximo 150 caracteres)"
    }
    
    IMPORTANTE:
    - No incluyas markdown
    - No uses ## ni # para títulos
    - Sé específico y profesional
    - Mantén cada campo bajo 150 caracteres
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Eres un experto en metrics de redes sociales y análisis de contenido viral. Responde SIEMPRE en JSON válido, sin markdown." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(response.choices[0].message.content || '{}');
        return result;
    } catch (error) {
        console.error("Virality analysis error:", error);
        return {
            viralityReason: "Análisis no disponible",
            bottleneck: "Análisis no disponible",
            engagement_trigger: "Análisis no disponible",
            audience_relevance: "Análisis no disponible"
        };
    }
};

export const generateIdeasFromResearch = async (postContent: string, researchData: any) => {
    const prompt = `
    SOURCE_POST: ${postContent}
    AUX_RESEARCH: ${JSON.stringify(researchData)}
    
    Genera 5 ideas de contenido viral para LinkedIn basadas en esto.
    Devuelve JSON con esta estructura:
    {
      "ideas": [
        {
          "title": "",
          "hook": "",
          "angle": "",
          "why_it_works": ""
        }
      ]
    }
    `;

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "You are a senior LinkedIn content strategist." }, { role: "user", content: prompt }],
        response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
}

