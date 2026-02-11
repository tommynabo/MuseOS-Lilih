import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Settings from './components/Settings';
import Login from './components/Login';
import ContentManager from './components/ContentManager';
import { CLIENT_PROFILES, INITIAL_CONTENT, MOCK_STATS } from './constants';
import { ContentPiece, ClientProfile, ClientPersona } from './types';
import { Session } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentProfile, setCurrentProfile] = useState<ClientProfile>(CLIENT_PROFILES['psychologist']);
  const [contentPieces, setContentPieces] = useState<ContentPiece[]>(INITIAL_CONTENT);
  const [selectedIdea, setSelectedIdea] = useState<ContentPiece | null>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        // Map snake_case to camelCase
        setCurrentProfile({
          id: 'psychologist', // generic ID for frontend logic
          name: data.role || 'Usuario', // mapping role to name for now or add name field
          role: data.role || 'User',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
          tone: data.tone || 'Empático',
          nicheKeywords: data.niche_keywords || [],
          targetCreators: [], // This is effectively replaced by the creators table, but keeping for type compat
          customInstructions: data.custom_instructions || '',
        });
      }
      // Load real posts after profile
      refreshPosts();
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPosts = async () => {
    try {
      const posts = await import('./services/geminiService').then(m => m.fetchPosts());
      if (Array.isArray(posts)) {
        // Transform DB posts to ContentPiece format if needed
        // The DB schema matches most fields, but we need to map snake_case to camelCase likely?
        // Let's check the API response format from routes.ts. It returns raw DB rows.
        // We need to map them to ContentPiece.

        const mappedPosts: ContentPiece[] = posts.map((p: any) => {
          const analysis = p.meta?.ai_analysis || p.meta?.structure || {};
          const hookText = analysis?.hook?.text || p.meta?.outline?.split('\n')[2] || "New Idea";

          return {
            id: p.id,
            sourceType: p.type === 'parasite' ? 'creator_reference' : 'keyword_search',
            originalAuthor: p.original_author || 'Unknown',
            originalUrl: p.original_url || p.meta?.original_url,
            sourceUrl: p.original_url || p.meta?.original_url,
            originalText: p.original_content,
            viralMetrics: p.meta?.engagement || { likes: 0, comments: 0 },
            tags: [p.type === 'parasite' ? 'Viral' : 'Research'],
            status: p.status || 'idea',
            targetDate: p.created_at,
            generatedDraft: {
              hook: hookText,
              body: p.generated_content || "",
              cta: "",
              researchNotes: p.meta?.news || [],
              viralityAnalysis: analysis?.virality_score ? {
                viralityReason: analysis.virality_score.verdict || '',
                bottleneck: analysis.engagement_mechanics?.why_people_comment || '',
                engagement_trigger: analysis.emotional_triggers?.primary_emotion || '',
                audience_relevance: analysis.narrative_arc?.structure || ''
              } : undefined
            },
            aiAnalysis: analysis?.hook ? analysis : undefined
          };
        });

        setContentPieces(mappedPosts);
      }
    } catch (e) {
      console.error("Error fetching posts:", e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSelectedIdea(null);
    setActiveTab('dashboard');
  };

  const handleIdeaSelect = (idea: ContentPiece) => {
    setSelectedIdea(idea);
  };

  const handleSaveContent = (updated: ContentPiece) => {
    setContentPieces(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedIdea(null);
  };

  /* New Handlers for Optimistic Updates */
  const handleUpdatePost = async (postId: string, newStatus: 'idea' | 'drafted' | 'approved' | 'posted') => {
    // 1. Optimistic Update
    setContentPieces(prev => prev.map(p =>
      p.id === postId ? { ...p, status: newStatus } : p
    ));

    // 2. API Call (background)
    try {
      const { updatePostStatus } = await import('./services/geminiService');
      await updatePostStatus(postId, newStatus);
    } catch (error) {
      console.error("Failed to update post status:", error);
      // Revert on failure (could be improved with a history stack)
      refreshPosts();
      alert("Error al actualizar el estado. Se revertirán los cambios.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    // 1. Optimistic Update
    setContentPieces(prev => prev.filter(p => p.id !== postId));
    if (selectedIdea?.id === postId) setSelectedIdea(null);

    // 2. API Call (background)
    try {
      const { deletePost } = await import('./services/geminiService');
      await deletePost(postId);
    } catch (error) {
      console.error("Failed to delete post:", error);
      refreshPosts();
      alert("Error al eliminar el post.");
    }
  };

  const handleProfileUpdate = async (updated: ClientProfile) => {
    // Optimistic update
    setCurrentProfile(updated);

    if (session?.user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: session.user.id, // ID must equal user_id due to DB constraint
            user_id: session.user.id,
            tone: updated.tone,
            niche_keywords: updated.nicheKeywords,
            custom_instructions: updated.customInstructions,
            role: updated.role,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (error) {
          console.error("Error saving profile:", error);
          alert(`Error al guardar: ${error.message}`);
        }
      } catch (err: any) {
        console.error("Unexpected error:", err);
        alert(`Error inesperado: ${err.message}`);
      }
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!session) {
    return <Login />;
  }

  // If editor is open, it takes over the main view (Modal mode or Full screen)
  if (selectedIdea) {
    return (
      <Editor
        content={selectedIdea}
        clientProfile={currentProfile}
        onClose={() => setSelectedIdea(null)}
        onSave={handleSaveContent}
        onDelete={handleDeletePost}
      />
    );
  }

  return (
    <Layout
      activeTab={activeTab}
      onNavigate={setActiveTab}
      currentProfile={currentProfile}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && (
        <Dashboard
          stats={MOCK_STATS[currentProfile.id]}
          ideas={contentPieces}
          onSelectIdea={handleIdeaSelect}
          onRefresh={refreshPosts}
          onUpdatePost={handleUpdatePost}
          onDeletePost={handleDeletePost}
        />
      )}
      {activeTab === 'content' && (
        <ContentManager
          ideas={contentPieces}
          onSelectIdea={handleIdeaSelect}
          onUpdatePost={handleUpdatePost}
          onDeletePost={handleDeletePost}
        />
      )}
      {activeTab === 'settings' && (
        <Settings
          profile={currentProfile}
          onUpdate={handleProfileUpdate}
        />
      )}
    </Layout>
  );
};

export default App;