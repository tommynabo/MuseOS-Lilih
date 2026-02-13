import cron from 'node-cron';
import { supabaseAdmin } from '../db';
import { generatePostOutline, generateIdeasFromResearch } from './openaiService';
import { searchLinkedInPosts } from './apifyService';

interface ScheduleConfig {
  id?: string;
  user_id: string;
  enabled: boolean;
  time: string; // "HH:MM" format
  timezone: string;
  source: 'keywords' | 'creators';
  count: number;
  last_execution?: Date;
  next_execution?: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface ScheduleExecution {
  id?: string;
  schedule_id: string;
  user_id: string;
  executed_at: Date;
  status: 'success' | 'failed' | 'pending';
  posts_generated: number;
  error_message?: string;
}

const TABLE_SCHEDULES = 'schedules';
const TABLE_EXECUTIONS = 'schedule_executions';

let activeJobs: Map<string, cron.ScheduledTask> = new Map();

/**
 * Convierte hora HH:MM a expresión cron (UTC)
 * Por ahora asumimos UTC. En producción usar librería de timezones.
 */
function timeToCronExpression(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${minutes} ${hours} * * *`; // min hour * * *
}

/**
 * Obtiene todas las configuraciones de schedule activos de un usuario
 */
export const getScheduleConfigs = async (
  userId: string
): Promise<ScheduleConfig[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_SCHEDULES)
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[SchedulerService] Error fetching schedules:', error);
    return [];
  }
};

/**
 * Crea o actualiza una configuración de schedule
 */
export const saveScheduleConfig = async (
  userId: string,
  config: Omit<ScheduleConfig, 'user_id' | 'created_at' | 'updated_at' | 'id'>
): Promise<ScheduleConfig | null> => {
  try {
    const now = new Date();

    // Verificar si ya existe un schedule para este usuario
    const { data: existing } = await supabaseAdmin
      .from(TABLE_SCHEDULES)
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;

    if (existing) {
      // Actualizar
      const { data, error } = await supabaseAdmin
        .from(TABLE_SCHEDULES)
        .update({
          ...config,
          updated_at: now
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Crear nuevo
      const { data, error } = await supabaseAdmin
        .from(TABLE_SCHEDULES)
        .insert({
          user_id: userId,
          ...config,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    console.log(`[SchedulerService] Schedule saved for user ${userId}`);
    return result;
  } catch (error) {
    console.error('[SchedulerService] Error saving schedule:', error);
    return null;
  }
};

/**
 * Registra una ejecución del schedule
 */
export const logScheduleExecution = async (
  scheduleId: string,
  userId: string,
  status: 'success' | 'failed' | 'pending',
  postsGenerated: number = 0,
  errorMessage?: string
): Promise<void> => {
  try {
    await supabaseAdmin.from(TABLE_EXECUTIONS).insert({
      schedule_id: scheduleId,
      user_id: userId,
      executed_at: new Date(),
      status,
      posts_generated: postsGenerated,
      error_message: errorMessage
    });

    console.log(
      `[SchedulerService] Execution logged: ${status} (${postsGenerated} posts)`
    );
  } catch (error) {
    console.error('[SchedulerService] Error logging execution:', error);
  }
};

/**
 * Ejecuta el workflow de generación automática
 */
async function executeScheduledWorkflow(
  scheduleId: string,
  userId: string,
  source: 'keywords' | 'creators',
  count: number
): Promise<{ success: boolean; postsGenerated: number; error?: string }> {
  try {
    console.log(
      `[SchedulerService] Executing scheduled workflow for user ${userId}`
    );

    // 1. Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    let keywords: string[] = [];
    let creators: any[] = [];

    // 2. Obtener keywords o creadores según la fuente
    if (source === 'keywords') {
      const { data: creatorData } = await supabaseAdmin
        .from('creators')
        .select('keywords')
        .eq('user_id', userId)
        .eq('enabled', true);

      // Extraer keywords de los creadores
      keywords = creatorData?.flatMap((c: any) => c.keywords || []) || [];
    } else {
      const { data: creatorData } = await supabaseAdmin
        .from('creators')
        .select('name, url')
        .eq('user_id', userId)
        .eq('enabled', true);

      creators = creatorData || [];
    }

    if (!keywords.length && !creators.length) {
      throw new Error(`No ${source} found for user`);
    }

    // 3. Buscar posts (solo si source es keywords)
    let generatedPosts = [];

    if (source === 'keywords' && keywords.length > 0) {
      const apifyPosts = await searchLinkedInPosts(keywords, count);

      if (apifyPosts && apifyPosts.length > 0) {
        // 4. Procesar con IA
        for (const post of apifyPosts.slice(0, count)) {
          try {
            const postContent = String(post.text || post.content || '');
            const outline = await generatePostOutline(postContent);
            const authorName = (post.author as any)?.name || 'Unknown';

            generatedPosts.push({
              title: `Post from ${authorName}`,
              content: outline,
              source_url: post.url || post.postUrl || '',
              status: 'idea',
              user_id: userId,
              created_at: new Date()
            });
          } catch (err) {
            console.error('[SchedulerService] Error processing post:', err);
          }
        }

        // 5. Guardar en BD
        if (generatedPosts.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('posts')
            .insert(generatedPosts);

          if (insertError) {
            throw new Error(`Failed to save posts: ${insertError.message}`);
          }
        }
      }
    }

    // Registrar ejecución exitosa
    await logScheduleExecution(
      scheduleId,
      userId,
      'success',
      generatedPosts.length
    );

    return { success: true, postsGenerated: generatedPosts.length };
  } catch (error: any) {
    console.error(
      '[SchedulerService] Error executing workflow:',
      error.message
    );

    // Registrar ejecución fallida
    await logScheduleExecution(
      scheduleId,
      userId,
      'failed',
      0,
      error.message
    );

    return {
      success: false,
      postsGenerated: 0,
      error: error.message
    };
  }
}

/**
 * Inicia un job cron para un schedule específico
 */
export const startScheduleJob = (scheduleConfig: ScheduleConfig): void => {
  const jobId = `${scheduleConfig.user_id}_${scheduleConfig.id}`;

  // No activar si ya existe o si está deshabilitado
  if (activeJobs.has(jobId) || !scheduleConfig.enabled) {
    return;
  }

  const cronExpression = timeToCronExpression(scheduleConfig.time);

  try {
    const task = cron.schedule(cronExpression, async () => {
      console.log(
        `[SchedulerService] ⏰ Executing schedule for user ${scheduleConfig.user_id}`
      );
      await executeScheduledWorkflow(
        scheduleConfig.id!,
        scheduleConfig.user_id,
        scheduleConfig.source,
        scheduleConfig.count
      );
    });

    activeJobs.set(jobId, task);
    console.log(`[SchedulerService] ✅ Schedule job started: ${jobId}`);
  } catch (error) {
    console.error(`[SchedulerService] Error starting job ${jobId}:`, error);
  }
};

/**
 * Detiene un job cron específico
 */
export const stopScheduleJob = (scheduleId: string, userId: string): void => {
  const jobId = `${userId}_${scheduleId}`;

  if (activeJobs.has(jobId)) {
    const task = activeJobs.get(jobId);
    task?.stop();
    activeJobs.delete(jobId);
    console.log(`[SchedulerService] ✅ Schedule job stopped: ${jobId}`);
  }
};

/**
 * Detiene todos los jobs
 */
export const stopAllScheduleJobs = (): void => {
  activeJobs.forEach((task) => {
    task.stop();
  });
  activeJobs.clear();
  console.log('[SchedulerService] ✅ All schedule jobs stopped');
};

/**
 * Inicializa todos los schedules activos para todos los usuarios
 * Debería llamarse al iniciar el servidor
 */
export const initializeSchedules = async (): Promise<void> => {
  try {
    console.log('[SchedulerService] 🚀 Initializing all schedules...');

    const { data: schedules, error } = await supabaseAdmin
      .from(TABLE_SCHEDULES)
      .select('*')
      .eq('enabled', true);

    if (error) throw error;

    if (!schedules || schedules.length === 0) {
      console.log('[SchedulerService] No active schedules found');
      return;
    }

    schedules.forEach((schedule) => {
      startScheduleJob(schedule);
    });

    console.log(
      `[SchedulerService] ✅ Initialized ${schedules.length} schedules`
    );
  } catch (error) {
    console.error('[SchedulerService] Error initializing schedules:', error);
  }
};
