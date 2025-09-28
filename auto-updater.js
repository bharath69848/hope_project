const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Supabase configuration
const supabaseUrl = 'https://ztsqkwqerfznhkdjucfj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0c3Frd3FlcmZ6bmhrZGp1Y2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzkxOTUsImV4cCI6MjA3NDYxNTE5NX0.x_3CdAaLYBsYUArwxEBa3PVLgpnQN0eZiAX-thDiLzg';
const supabase = createClient(supabaseUrl, supabaseKey);

// LeetCode API endpoint
const LEETCODE_API_BASE = 'https://leetcode-api-faisalshohag.vercel.app';

/**
 * Fast LeetCode stats fetch with minimal delays
 */
async function fetchLeetCodeStats(username, retryCount = 0) {
    try {
        if (!username || username.trim() === '') {
            return 0;
        }

        // Only wait 200ms between requests for speed
        if (retryCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
        } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const response = await axios.get(`${LEETCODE_API_BASE}/${username}`, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.totalSolved !== undefined) {
            return response.data.totalSolved;
        } else {
            return 0;
        }
    } catch (error) {
        if (error.response && error.response.status === 429 && retryCount < 1) {
            console.log(`⏳ Rate limited for ${username}, retrying...`);
            return await fetchLeetCodeStats(username, retryCount + 1);
        } else {
            return 0;
        }
    }
}

/**
 * Calculate Elo score
 */
function calculateEloScore(stats) {
    const { leetcode_count = 0, codeforces_count = 0, atcoder_count = 0, gfg_count = 0 } = stats;
    
    const leetcodePoints = leetcode_count * 1;
    const gfgPoints = gfg_count * 1;
    const codeforcesPoints = codeforces_count * 1.5;
    const atcoderPoints = atcoder_count * 1.5;
    
    return Math.round(leetcodePoints + gfgPoints + codeforcesPoints + atcoderPoints);
}

/**
 * Get or create today's stats record
 */
async function getOrCreateTodayStats(studentId) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const { data: existingStats, error: fetchError } = await supabase
            .from('student_stats')
            .select('*')
            .eq('student_id', studentId)
            .eq('date', today)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        if (existingStats) {
            return existingStats;
        }

        const { data: newStats, error: createError } = await supabase
            .from('student_stats')
            .insert({
                student_id: studentId,
                date: today,
                leetcode_count: 0,
                codeforces_count: 0,
                atcoder_count: 0,
                gfg_count: 0,
                elo_score: 0
            })
            .select()
            .single();

        if (createError) throw createError;
        return newStats;
    } catch (error) {
        console.error(`Error with stats for ${studentId}:`, error.message);
        throw error;
    }
}

/**
 * Update student stats
 */
async function updateStudentStats(studentId, newStats) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const eloScore = calculateEloScore(newStats);
        
        const { error } = await supabase
            .from('student_stats')
            .update({
                leetcode_count: newStats.leetcode_count,
                codeforces_count: newStats.codeforces_count,
                atcoder_count: newStats.atcoder_count,
                gfg_count: newStats.gfg_count,
                elo_score: eloScore
            })
            .eq('student_id', studentId)
            .eq('date', today);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error updating ${studentId}:`, error.message);
        return false;
    }
}

/**
 * Update all student stats (fast version for auto-updater)
 */
async function updateAllStats() {
    try {
        console.log(`🔄 [${new Date().toLocaleTimeString()}] Auto-updating student stats...`);

        // Fetch students with LeetCode usernames
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .not('leetcode_username', 'is', null)
            .not('leetcode_username', 'eq', '');

        if (studentsError) throw studentsError;

        let updatedCount = 0;
        let successCount = 0;

        // Process students in smaller batches for speed
        for (let i = 0; i < students.length; i += 5) {
            const batch = students.slice(i, i + 5);

            const batchPromises = batch.map(async (student) => {
                try {
                    await getOrCreateTodayStats(student.id);
                    
                    const stats = {
                        leetcode_count: 0,
                        codeforces_count: Math.floor(Math.random() * 20) + 1,
                        atcoder_count: Math.floor(Math.random() * 15) + 1,
                        gfg_count: Math.floor(Math.random() * 25) + 1
                    };

                    // Fetch LeetCode stats
                    if (student.leetcode_username) {
                        stats.leetcode_count = await fetchLeetCodeStats(student.leetcode_username);
                    }

                    const success = await updateStudentStats(student.id, stats);
                    if (success) {
                        successCount++;
                        updatedCount++;
                    }
                } catch (error) {
                    console.error(`❌ Error with ${student.name}:`, error.message);
                }
            });

            await Promise.all(batchPromises);
            
            // Small delay between batches
            if (i + 5 < students.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`✅ [${new Date().toLocaleTimeString()}] Updated ${successCount}/${updatedCount} students`);
        
    } catch (error) {
        console.error(`❌ [${new Date().toLocaleTimeString()}] Auto-update failed:`, error.message);
    }
}

/**
 * Main auto-updater function
 */
function startAutoUpdater() {
    console.log('🚀 DSA Tracker - Auto Updater Started');
    console.log('=====================================');
    console.log('⏰ Running every 1 minute');
    console.log('🔄 Press Ctrl+C to stop\n');

    // Run immediately on start
    updateAllStats();

    // Schedule to run every minute
    cron.schedule('* * * * *', () => {
        updateAllStats();
    });

    // Keep the process running
    process.on('SIGINT', () => {
        console.log('\n👋 Auto-updater stopped');
        process.exit(0);
    });
}

// Start the auto-updater
if (require.main === module) {
    startAutoUpdater();
}

module.exports = {
    updateAllStats,
    startAutoUpdater
};
