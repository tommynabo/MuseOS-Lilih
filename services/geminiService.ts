import { ClientProfile } from "../types";
import { supabase } from "../supabaseClient";

// Use relative path for Vercel, or fallback to localhost for local dev if not proxied
const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

const getHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export const generateRefinedDraft = async (
  originalText: string,
  clientProfile: ClientProfile,
  instruction: 'shorten' | 'punchier' | 'add_fact' | 'rewrite'
): Promise<string> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/rewrite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: originalText,
        profile: clientProfile,
        instruction
      }),
    });

    if (!response.ok) {
      throw new Error('Backend request failed');
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("API Error:", error);
    return "Error conectando con el servidor backend.";
  }
};

export const runParasiteWorkflow = async () => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/workflow/parasite`, {
    method: 'POST',
    headers
  });
  return response.json();
};

export const runResearchWorkflow = async (topic: string) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/workflow/research`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ topic })
  });
  return response.json();
};

/**
 * Unified workflow that uses profile settings (no popup needed)
 * @param source - 'keywords' or 'creators'
 * @param count - Number of posts to generate
 */
export const runGenerateWorkflow = async (source: 'keywords' | 'creators', count: number = 3) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/workflow/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source, count })
  });
  return response.json();
};

export const fetchCreators = async () => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/creators`, {
    headers
  });
  return response.json();
};

export const addCreator = async (creator: { name: string, linkedinUrl: string }) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/creators`, {
    method: 'POST',
    headers,
    body: JSON.stringify(creator)
  });
  return response.json();
};

export const deleteCreator = async (id: number) => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/creators/${id}`, {
    method: 'DELETE',
    headers
  });
  return response.json();
};

export const fetchPosts = async () => {
  const headers = await getHeaders();
  // Add timestamp to prevent caching (fix 304 issues)
  const response = await fetch(`${API_URL}/posts?t=${Date.now()}`, {
    headers,
    cache: 'no-store'
  });
  return response.json();
};

export const updatePostStatus = async (postId: string, status: 'idea' | 'drafted' | 'approved' | 'posted') => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/posts/${postId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    throw new Error('Failed to update post status');
  }
  return response.json();
};