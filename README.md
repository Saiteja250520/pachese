# PACHESE — The Royal 7-Cowrie Chaupar Game

An authentic, real-time multiplayer implementation of traditional **Pachese / Chaupar**, featuring 7 cowrie shells, 16 coins across 2 teams, safe blocks, quadruple-stack vulnerabilities, capture bonuses, and the defining **full-turn rollback rule**.

---

## 🌟 Key Features

1. **Exact 7-Cowrie Scoring Table & Probabilities:**
   - `0W + 7B` = **7** moves + Bonus Throw
   - `1W + 6B` = **10** moves + Bonus Throw + **Can enter coin**
   - `2W + 5B` = **2** moves
   - `3W + 4B` = **3** moves
   - `4W + 3B` = **4** moves
   - `5W + 2B` = **25** moves + Bonus Throw + **Can enter coin**
   - `6W + 1B` = **30** moves + Bonus Throw + **Can enter coin**
   - `7W + 0B` = **14** moves + Bonus Throw
   - **Three Consecutive Specials:** 3 consecutive rolls of 10, 25, or 30 cancel all 3 and grant 1 fresh roll (broken by 7 or 14).

2. **100% Live Transparency for Opponents & Teams:**
   - Both teams and all players see the 7 cowrie shells tumbling and settling live.
   - Collected score tray (`[25] [10] [4]`) is shared and updated in real-time.
   - When the Leader selects a coin and score, a glowing **ghost path** illuminates the route on the board.
   - Opponents see the coin physically move step-by-step with sound effects.

3. **Authentic Board Layout & Track Geometry:**
   - 4-arm cross board ($3 \times 8 = 24$ squares per arm, 96 track squares + central diamond **Charkoni**).
   - Beaded green border styling with dark maroon velvet squares.
   - Pink `X` safe marks on the side columns (row 3 from outer tip).
   - Red starting dots at the innermost middle lane square of Right Arm (**T1**) and Left Arm (**T2**).
   - Middle lanes are strictly private to each team.

4. **Authentic Game Mechanics:**
   - **Option B Entry:** Rolling 10, 25, or 30 places a coin on the red dot for free; the Leader can spend the score on the new coin or any active coin.
   - **No Splitting:** A single throw score cannot be split between two coins.
   - **Quadruple-Stack Danger:** 1–3 friendly coins on an `X` block all enemies from landing. If 4 friendly coins stack on an `X`, an enemy landing there captures all 4 at once!
   - **Home Entry Lock:** A team must make at least **one capture** to unlock home entry.
   - **No Landing on Start Block on Return:** A returning coin is strictly forbidden from ending its move directly on the start block.
   - **Full-Turn Rollback:** If the collected scores cannot be completely and legally played, the whole turn rewinds to the pre-turn snapshot and passes to the opponent.

5. **Multiplayer & Solo Modes:**
   - **1 vs 1** (2 players)
   - **2 vs 2** (4 players with alternating throw order and designated Team Leaders)
   - **Solo vs Smart AI Bots** (instant testing and single-player practice)

---

## 🚀 Running the Game

### Start Server
```powershell
cd C:\Users\Admin\.gemini\antigravity\scratch\pachese_game
node server.js
```
Open your browser at:
```
http://localhost:3000
```

### Playing with Online Friends
* **On Local Wi-Fi:** Friends on the same network can open `http://<YOUR_LOCAL_IP>:3000` on their phone or laptop.
* **Over the Internet:** Run a free tunnel:
  ```powershell
  npx localtunnel --port 3000
  # or
  ngrok http 3000
  ```
  Share the generated link and 5-letter **Room Code** with your friends!
