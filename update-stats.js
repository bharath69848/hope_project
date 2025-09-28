const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Supabase configuration
const supabaseUrl = 'https://ztsqkwqerfznhkdjucfj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0c3Frd3FlcmZ6bmhrZGp1Y2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzkxOTUsImV4cCI6MjA3NDYxNTE5NX0.x_3CdAaLYBsYUArwxEBa3PVLgpnQN0eZiAX-thDiLzg';
const supabase = createClient(supabaseUrl, supabaseKey);

// LeetCode API endpoint
const LEETCODE_API_BASE = 'https://leetcode-api-faisalshohag.vercel.app';

/**
 * Fetch LeetCode stats for a username with retry logic and rate limiting
 * @param {string} username - LeetCode username
 * @returns {Promise<number>} - Number of problems solved
 */
async function fetchLeetCodeStats(username, retryCount = 0) {
    try {
        if (!username || username.trim() === '') {
            console.log(`No LeetCode username provided`);
            return 0;
        }

        console.log(`Fetching LeetCode stats for: ${username} (attempt ${retryCount + 1})`);
        
        // Add delay between requests to avoid rate limiting
        if (retryCount > 0) {
            const delay = Math.min(2000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        } else {
            // Always wait at least 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const response = await axios.get(`${LEETCODE_API_BASE}/${username}`, {
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.totalSolved !== undefined) {
            console.log(`✅ LeetCode stats for ${username}: ${response.data.totalSolved} problems solved`);
            return response.data.totalSolved;
        } else {
            console.log(`❌ Invalid LeetCode API response for ${username}`);
            return 0;
        }
    } catch (error) {
        if (error.response && error.response.status === 429 && retryCount < 3) {
            console.log(`⏳ Rate limited for ${username}, retrying... (attempt ${retryCount + 1}/3)`);
            return await fetchLeetCodeStats(username, retryCount + 1);
        } else {
            console.error(`❌ Error fetching LeetCode stats for ${username}:`, error.message);
            return 0;
        }
    }
}

/**
 * Calculate Elo score based on PRD formula
 * @param {Object} stats - Stats object with platform counts
 * @returns {number} - Calculated Elo score
 */
function calculateEloScore(stats) {
    const { leetcode_count = 0, codeforces_count = 0, atcoder_count = 0, gfg_count = 0 } = stats;
    
    // Base points per problem (from PRD)
    const leetcodePoints = leetcode_count * 1;
    const gfgPoints = gfg_count * 1;
    const codeforcesPoints = codeforces_count * 1.5;
    const atcoderPoints = atcoder_count * 1.5;
    
    // For now, we'll use a simple consistency bonus
    // TODO: Implement 7-day streak tracking in Phase 2
    const consistencyBonus = 0; // Will be implemented later
    
    const elo = leetcodePoints + gfgPoints + codeforcesPoints + atcoderPoints + consistencyBonus;
    
    return Math.round(elo);
}

/**
 * Get or create today's stats record for a student
 * @param {string} studentId - Student UUID
 * @returns {Promise<Object>} - Today's stats record
 */
async function getOrCreateTodayStats(studentId) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    try {
        // Check if stats exist for today
        const { data: existingStats, error: fetchError } = await supabase
            .from('student_stats')
            .select('*')
            .eq('student_id', studentId)
            .eq('date', today)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw fetchError;
        }

        if (existingStats) {
            return existingStats;
        }

        // Create new stats record for today
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
 * @param {string} studentId - Student UUID
 * @param {Object} newStats - New stats to update
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

        console.log(`Updated stats for student ${studentId}: Elo = ${eloScore}`);
    } catch (error) {
        console.error(`Error updating stats for student ${studentId}:`, error);
        throw error;
    }
}

/**
 * Process all students and update their stats
 */
async function updateAllStudentStats() {
    try {
        console.log('Starting stats update process...');
        
        // Fetch all students
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('*');

        if (studentsError) throw studentsError;

        console.log(`Found ${students.length} students to process`);

        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            try {
                console.log(`\n[${i + 1}/${students.length}] Processing student: ${student.name} (${student.batch})`);
                
                // Get or create today's stats record
                await getOrCreateTodayStats(student.id);
                
                // Initialize stats object
                const stats = {
                    leetcode_count: 0,
                    codeforces_count: 0,
                    atcoder_count: 0,
                    gfg_count: 0
                };

                // Fetch LeetCode stats if username exists
                if (student.leetcode_username) {
                    stats.leetcode_count = await fetchLeetCodeStats(student.leetcode_username);
                }

                // For other platforms, we'll add random values for now as per requirements
                // TODO: Implement real API calls for these platforms in Phase 2
                if (student.codeforces_username) {
                    stats.codeforces_count = Math.floor(Math.random() * 20) + 1; // Random 1-20
                    console.log(`🎯 Codeforces stats for ${student.name}: ${stats.codeforces_count} (random)`);
                }

                if (student.atcoder_username) {
                    stats.atcoder_count = Math.floor(Math.random() * 15) + 1; // Random 1-15
                    console.log(`🎯 AtCoder stats for ${student.name}: ${stats.atcoder_count} (random)`);
                }

                if (student.gfg_username) {
                    stats.gfg_count = Math.floor(Math.random() * 25) + 1; // Random 1-25
                    console.log(`🎯 GFG stats for ${student.name}: ${stats.gfg_count} (random)`);
                }

                // Update stats in database
                await updateStudentStats(student.id, stats);

                // Progress indicator
                const progress = Math.round(((i + 1) / students.length) * 100);
                console.log(`📊 Progress: ${progress}% (${i + 1}/${students.length})`);

            } catch (error) {
                console.error(`❌ Error processing student ${student.name}:`, error);
                // Continue with next student
            }
        }

        console.log('\n✅ Stats update process completed!');
        
    } catch (error) {
        console.error('Error in updateAllStudentStats:', error);
        throw error;
    }
}

/**
 * Add some sample students to the database if none exist
 */
async function addSampleStudents() {
    try {
        // Check if students already exist
        const { data: existingStudents, error: fetchError } = await supabase
            .from('students')
            .select('*')
            .limit(1);

        if (fetchError) throw fetchError;

        if (existingStudents && existingStudents.length > 0) {
            console.log('Students already exist in database');
            return;
        }

        console.log('Adding sample students...');

        const sampleStudents = [
            {
                name: 'John Doe',
                batch: 'Dream',
                leetcode_username: 'johndoe123',
                codeforces_username: 'johndoe_cf',
                atcoder_username: 'johndoe_ac',
                gfg_username: 'johndoe_gfg'
            },
            {
                name: 'Jane Smith',
                batch: 'Dream',
                leetcode_username: 'janesmith',
                codeforces_username: 'janesmith_cf',
                atcoder_username: 'janesmith_ac',
                gfg_username: 'janesmith_gfg'
            },
            {
                name: 'Mike Johnson',
                batch: 'Elite',
                leetcode_username: 'mikejohnson',
                codeforces_username: 'mikejohnson_cf',
                atcoder_username: 'mikejohnson_ac',
                gfg_username: 'mikejohnson_gfg'
            },
            {
                name: 'Sarah Wilson',
                batch: 'Elite',
                leetcode_username: 'sarahwilson',
                codeforces_username: 'sarahwilson_cf',
                atcoder_username: 'sarahwilson_ac',
                gfg_username: 'sarahwilson_gfg'
            },
            {
                name: 'Alex Brown',
                batch: 'Dream',
                leetcode_username: 'alexbrown',
                codeforces_username: 'alexbrown_cf',
                atcoder_username: 'alexbrown_ac',
                gfg_username: 'alexbrown_gfg'
            }
        ];

        const { error } = await supabase
            .from('students')
            .insert(sampleStudents);

        if (error) throw error;

        console.log('✅ Sample students added successfully!');
        
    } catch (error) {
        console.error('Error adding sample students:', error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        console.log('🚀 DSA Tracker - Stats Update Script');
        console.log('=====================================\n');

        // Add sample students if database is empty
        await addSampleStudents();

        // Update all student stats
        await updateAllStudentStats();

        console.log('\n🎉 All done! Check your dashboard at dashboard.html');
        
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    fetchLeetCodeStats,
    calculateEloScore,
    updateAllStudentStats
};
