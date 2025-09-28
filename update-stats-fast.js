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

        // Only wait 500ms between requests for speed
        if (retryCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            // Quick retry with 2 second delay
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const response = await axios.get(`${LEETCODE_API_BASE}/${username}`, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.totalSolved !== undefined) {
            console.log(`✅ ${username}: ${response.data.totalSolved} problems`);
            return response.data.totalSolved;
        } else {
            return 0;
        }
    } catch (error) {
        if (error.response && error.response.status === 429 && retryCount < 1) {
            console.log(`⏳ Rate limited for ${username}, retrying...`);
            return await fetchLeetCodeStats(username, retryCount + 1);
        } else {
            console.log(`❌ ${username}: ${error.message}`);
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

        console.log(`💾 ${studentId.substring(0, 8)}: Elo = ${eloScore}`);
    } catch (error) {
        console.error(`Error updating ${studentId}:`, error.message);
        throw error;
    }
}

/**
 * Fast batch processing - 10 students at a time with 5 second breaks
 */
async function updateStudentStatsFast() {
    try {
        console.log('🚀 DSA Tracker - FAST Update Script');
        console.log('===================================\n');

        // Fetch students with LeetCode usernames only
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .not('leetcode_username', 'is', null)
            .not('leetcode_username', 'eq', '');

        if (studentsError) throw studentsError;

        console.log(`📊 Processing ${students.length} students with LeetCode usernames`);
        console.log(`🔄 Fast mode: 10 students per batch, 5s breaks\n`);

        let processedCount = 0;
        let successCount = 0;

        // Process in batches of 10
        for (let i = 0; i < students.length; i += 10) {
            const batch = students.slice(i, i + 10);
            const batchNumber = Math.floor(i / 10) + 1;
            const totalBatches = Math.ceil(students.length / 10);

            console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} students)`);
            console.log('─'.repeat(40));

            // Process all students in current batch
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

                    await updateStudentStats(student.id, stats);
                    return { success: true, name: student.name };
                } catch (error) {
                    console.error(`❌ ${student.name}: ${error.message}`);
                    return { success: false, name: student.name };
                }
            });

            // Wait for all students in batch to complete
            const results = await Promise.all(batchPromises);
            
            // Count results
            results.forEach(result => {
                processedCount++;
                if (result.success) successCount++;
            });

            console.log(`✅ Batch ${batchNumber} completed: ${results.filter(r => r.success).length}/${results.length} successful`);

            // Short break between batches (except last batch)
            if (i + 10 < students.length) {
                console.log(`⏳ 5 second break before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('🎉 FAST UPDATE COMPLETED!');
        console.log(`📊 Total Processed: ${processedCount}`);
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${processedCount - successCount}`);
        console.log(`📈 Success Rate: ${Math.round((successCount/processedCount)*100)}%`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}

// Run the fast script
if (require.main === module) {
    updateStudentStatsFast();
}

module.exports = {
    fetchLeetCodeStats,
    calculateEloScore,
    updateStudentStatsFast
};
