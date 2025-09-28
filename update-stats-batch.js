const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Supabase configuration
const supabaseUrl = 'https://ztsqkwqerfznhkdjucfj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0c3Frd3FlcmZ6bmhrZGp1Y2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzkxOTUsImV4cCI6MjA3NDYxNTE5NX0.x_3CdAaLYBsYUArwxEBa3PVLgpnQN0eZiAX-thDiLzg';
const supabase = createClient(supabaseUrl, supabaseKey);

// LeetCode API endpoint
const LEETCODE_API_BASE = 'https://leetcode-api-faisalshohag.vercel.app';

/**
 * Fetch LeetCode stats with aggressive rate limiting
 */
async function fetchLeetCodeStats(username, retryCount = 0) {
    try {
        if (!username || username.trim() === '') {
            return 0;
        }

        console.log(`🔍 Fetching LeetCode stats for: ${username} (attempt ${retryCount + 1})`);
        
        // Always wait 2 seconds between requests to avoid rate limiting
        if (retryCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            // Exponential backoff for retries
            const delay = Math.min(5000 * Math.pow(2, retryCount), 30000);
            console.log(`⏳ Waiting ${delay/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        const response = await axios.get(`${LEETCODE_API_BASE}/${username}`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        if (response.data && response.data.totalSolved !== undefined) {
            console.log(`✅ LeetCode stats for ${username}: ${response.data.totalSolved} problems solved`);
            return response.data.totalSolved;
        } else {
            console.log(`❌ Invalid API response for ${username}`);
            return 0;
        }
    } catch (error) {
        if (error.response && error.response.status === 429 && retryCount < 2) {
            console.log(`⏳ Rate limited for ${username}, retrying in 30 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 30000));
            return await fetchLeetCodeStats(username, retryCount + 1);
        } else {
            console.error(`❌ Error fetching LeetCode stats for ${username}:`, error.message);
            return 0;
        }
    }
}

/**
 * Calculate Elo score based on PRD formula
 */
function calculateEloScore(stats) {
    const { leetcode_count = 0, codeforces_count = 0, atcoder_count = 0, gfg_count = 0 } = stats;
    
    const leetcodePoints = leetcode_count * 1;
    const gfgPoints = gfg_count * 1;
    const codeforcesPoints = codeforces_count * 1.5;
    const atcoderPoints = atcoder_count * 1.5;
    
    const elo = leetcodePoints + gfgPoints + codeforcesPoints + atcoderPoints;
    return Math.round(elo);
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
        console.error(`Error getting/creating stats for student ${studentId}:`, error);
        throw error;
    }
}

/**
 * Update student stats in database
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

        console.log(`💾 Updated stats for student ${studentId}: Elo = ${eloScore}`);
    } catch (error) {
        console.error(`Error updating stats for student ${studentId}:`, error);
        throw error;
    }
}

/**
 * Process students in small batches to avoid rate limiting
 */
async function updateStudentStatsBatch(batchSize = 5, delayBetweenBatches = 60000) {
    try {
        console.log('🚀 DSA Tracker - Batch Stats Update Script');
        console.log('==========================================\n');

        // Fetch all students
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .not('leetcode_username', 'is', null)
            .not('leetcode_username', 'eq', '');

        if (studentsError) throw studentsError;

        console.log(`📊 Found ${students.length} students with LeetCode usernames`);
        console.log(`🔄 Processing in batches of ${batchSize} students\n`);

        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < students.length; i += batchSize) {
            const batch = students.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(students.length / batchSize);

            console.log(`\n📦 Processing Batch ${batchNumber}/${totalBatches} (${batch.length} students)`);
            console.log('=' * 50);

            for (const student of batch) {
                try {
                    console.log(`\n[${processedCount + 1}/${students.length}] Processing: ${student.name} (${student.batch})`);
                    
                    await getOrCreateTodayStats(student.id);
                    
                    const stats = {
                        leetcode_count: 0,
                        codeforces_count: 0,
                        atcoder_count: 0,
                        gfg_count: 0
                    };

                    // Fetch LeetCode stats
                    if (student.leetcode_username) {
                        stats.leetcode_count = await fetchLeetCodeStats(student.leetcode_username);
                    }

                    // Random values for other platforms
                    if (student.codeforces_username) {
                        stats.codeforces_count = Math.floor(Math.random() * 20) + 1;
                    }
                    if (student.atcoder_username) {
                        stats.atcoder_count = Math.floor(Math.random() * 15) + 1;
                    }
                    if (student.gfg_username) {
                        stats.gfg_count = Math.floor(Math.random() * 25) + 1;
                    }

                    await updateStudentStats(student.id, stats);
                    successCount++;
                    processedCount++;

                } catch (error) {
                    console.error(`❌ Error processing ${student.name}:`, error.message);
                    errorCount++;
                    processedCount++;
                }
            }

            // Wait between batches (except for the last batch)
            if (i + batchSize < students.length) {
                console.log(`\n⏳ Waiting ${delayBetweenBatches/1000} seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        console.log('\n' + '=' * 50);
        console.log('🎉 BATCH PROCESSING COMPLETED!');
        console.log(`📊 Total Processed: ${processedCount}`);
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('=' * 50);

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}

// Run the batch script
if (require.main === module) {
    // Process 3 students at a time, wait 2 minutes between batches
    updateStudentStatsBatch(3, 120000);
}

module.exports = {
    fetchLeetCodeStats,
    calculateEloScore,
    updateStudentStatsBatch
};
