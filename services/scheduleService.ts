import { supabase } from "../supabaseClient";

const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

const getHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

interface ScheduleConfig {
  enabled: boolean;
  time: string;
  timezone?: string;
  source: 'keywords' | 'creators';
  count: number;
}

interface ScheduleResponse {
  status: string;
  schedule?: ScheduleConfig & { id?: string };
  message?: string;
}

/**
 * Get current schedule configuration
 */
export const getScheduleConfig = async (): Promise<ScheduleConfig | null> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/schedule`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to fetch schedule');
    }

    const data = await response.json();
    return data.schedule || null;
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return null;
  }
};

/**
 * Save schedule configuration
 */
export const saveScheduleConfig = async (config: ScheduleConfig): Promise<ScheduleResponse> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/schedule`, {
      method: 'POST',
      headers,
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error('Failed to save schedule');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving schedule:', error);
    throw error;
  }
};

/**
 * Toggle schedule on/off
 */
export const toggleSchedule = async (): Promise<ScheduleResponse> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/schedule/toggle`, {
      method: 'PUT',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to toggle schedule');
    }

    return await response.json();
  } catch (error) {
    console.error('Error toggling schedule:', error);
    throw error;
  }
};

/**
 * Get schedule execution history
 */
export const getScheduleExecutions = async (limit: number = 10): Promise<any[]> => {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/schedule/executions?limit=${limit}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error('Failed to fetch executions');
    }

    const data = await response.json();
    return data.executions || [];
  } catch (error) {
    console.error('Error fetching executions:', error);
    return [];
  }
};
