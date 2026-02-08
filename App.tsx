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
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
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

  const handleProfileUpdate = async (updated: ClientProfile) => {
    // Optimistic update
    setCurrentProfile(updated);

    if (session?.user) {
      const { error } = await supabase.from('profiles').upsert({
        user_id: session.user.id,
        tone: updated.tone,
        niche_keywords: updated.nicheKeywords,
        custom_instructions: updated.customInstructions,
        role: updated.role,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (error) {
        console.error("Error saving profile:", error);
        alert("Error al guardar la configuración.");
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
        />
      )}
      {activeTab === 'content' && (
        <ContentManager
          ideas={contentPieces}
          onSelectIdea={handleIdeaSelect}
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