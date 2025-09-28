# 🎯 DSA Tracker

A minimal student performance tracker for Dream & Elite batches. This app tracks problem-solving activity across multiple platforms (LeetCode, Codeforces, AtCoder, GFG) and calculates an Elo-like score based on consistency and difficulty.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Modern web browser

### Installation

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the stats update script**
   ```bash
   npm start
   ```

4. **Open the application**
   - Open `login.html` in your web browser
   - Use credentials: `admin` / `pass123`

## 📁 Project Structure

```
├── login.html          # Admin login page
├── dashboard.html      # Main dashboard with student leaderboard
├── update-stats.js     # Node.js script to fetch API data and update stats
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## 🎯 Features

### ✅ Phase 0 - Manual Dashboard (Current)
- [x] Hardcoded Admin login
- [x] Supabase database integration
- [x] Student data display with batch filtering
- [x] Basic leaderboard with Elo scores
- [x] LeetCode API integration (real data)
- [x] Other platforms with random values (as requested)

### 🔄 Phase 1 - Automated Stats (Next)
- [ ] Automated daily stats fetching
- [ ] Cron job setup for regular updates

### 🔮 Phase 2 - Extend Platforms
- [ ] Codeforces API integration
- [ ] AtCoder API integration  
- [ ] GFG API integration
- [ ] 7-day streak consistency tracking

## 🗄️ Database Schema

The app uses Supabase with two main tables:

### `students`
- `id` (UUID, Primary Key)
- `name` (Text)
- `batch` (Text: 'Dream' or 'Elite')
- `leetcode_username` (Text)
- `codeforces_username` (Text)
- `atcoder_username` (Text)
- `gfg_username` (Text)
- `created_at` (Timestamp)

### `student_stats`
- `id` (UUID, Primary Key)
- `student_id` (UUID, Foreign Key)
- `date` (Date)
- `leetcode_count` (Integer)
- `codeforces_count` (Integer)
- `atcoder_count` (Integer)
- `gfg_count` (Integer)
- `elo_score` (Integer)

## 🧮 Elo Formula

```
Elo = (LC × 1) + (GFG × 1) + (CF × 1.5) + (AC × 1.5) + ConsistencyBonus
```

- **LeetCode**: 1 point per problem
- **GFG**: 1 point per problem  
- **Codeforces**: 1.5 points per problem
- **AtCoder**: 1.5 points per problem
- **Consistency Bonus**: +2 × streak_length (max 14) - *Coming in Phase 2*

## 🔧 API Endpoints Used

- **LeetCode**: `https://leetcode-api-faisalshohag.vercel.app/{username}`
- **Codeforces**: `https://codeforces.com/api/user.status?handle={handle}` *(Coming in Phase 2)*
- **AtCoder**: `@qatadaazzeh/atcoder-api` *(Coming in Phase 2)*
- **GFG**: `https://geeks-for-geeks-api.vercel.app/` *(Coming in Phase 2)*

## 🎮 Usage

1. **Login**: Use `admin` / `pass123` to access the dashboard
2. **View Students**: Switch between Dream and Elite batches using tabs
3. **Monitor Progress**: See real-time LeetCode stats and calculated Elo scores
4. **Update Data**: Run `npm start` to fetch latest data from APIs

## 🛠️ Development

### Running the Update Script
```bash
npm start
```

### Adding New Students
Insert records directly into the Supabase `students` table with the required fields.

### Customizing Elo Calculation
Modify the `calculateEloScore()` function in `update-stats.js`.

## 📝 Notes

- Currently, only LeetCode data is fetched from real APIs
- Other platforms show random values as requested for initial setup
- The app is designed as a prototype with simple HTML/CSS/JS frontend
- All data is stored in Supabase cloud database
- No authentication for students (admin-only access)

## 🚀 Next Steps

1. Set up automated daily updates with cron jobs
2. Integrate remaining platform APIs (Codeforces, AtCoder, GFG)
3. Implement streak tracking and consistency bonuses
4. Add data visualization and historical tracking
5. Enhance UI with sorting, filtering, and advanced features

---

**Built for Dream & Elite batches** 🎯
"# hope_project" 
