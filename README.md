# Discord Fact of the Day Bot 📚

A Discord bot that automatically sends a random interesting fact every day to any server!

## Features

- 🤖 Automatically posts facts daily at 9:00 AM
- 🌍 Works across multiple Discord servers
- ⚙️ Server admins can choose which channel receives daily facts
- 📖 Manual `!fact` command to get facts anytime
- 🏓 `!ping` command to check bot status
- 💾 Saves settings automatically
- ☁️ Runs 24/7 on Railway

## Commands

### 👥 User Commands (Everyone Can Use)
- `!fact` - Get a random fact immediately
- `!ping` - Check if the bot is online
- `!bothelp` - Show all commands
- `!info` - Show setup information for this server

### 🔧 Admin Commands (Administrator Permission Required)
- `!setchannel` - Enable daily facts in the current channel
- `!removechannel` - Disable daily facts in this server

## How to Use

### For Server Owners/Admins:

1. **Invite the bot** to your Discord server (use the invite link)
2. Go to the channel where you want daily facts posted
3. Type `!setchannel` in that channel
4. Done! You'll get a fact every day at 9:00 AM

### For Regular Users:

- Type `!fact` anytime to get a random fact
- Type `!info` to see if daily facts are enabled in your server
- Type `!bothelp` to see all available commands

## Setup for Developers

### Prerequisites
- Python 3.10 or higher
- A Discord account
- A Discord server where you have admin permissions

### Local Installation

1. **Clone this repository:**
   ```bash
   git clone https://github.com/MuhaiminRoshaizadi/discord-facts-bot.git
   cd discord-facts-bot