# Discord Fact of the Day Bot 📚

A Discord bot that automatically sends a random interesting fact every day to any server!

## Features

- 🤖 Automatically posts facts daily at 9:00 AM
- 🌍 Works across multiple Discord servers
- ⚙️ Server admins can choose which channel receives daily facts
- 📖 Manual `!fact` command to get facts anytime
- 🏓 `!ping` command to check bot status
- 💾 Saves settings automatically

## Commands

### 👥 User Commands (Everyone Can Use)
- `!fact` - Get a random fact immediately
- `!ping` - Check if the bot is online
- `!help` - Show all commands
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

## Setup for Developers

### Prerequisites
- Python 3.10 or higher
- A Discord account
- A Discord server where you have admin permissions

### Installation

1. **Clone this repository:**
   ```bash
   git clone https://github.com/MuhaiminRoshaizadi/discord-facts-bot.git
   cd discord-facts-bot
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create a `.env` file:**
   ```env
   DISCORD_TOKEN=your_bot_token_here
   ```

4. **Get your Discord bot token:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" tab and create a bot
   - Copy the token and paste it in `.env`
   - Enable "Message Content Intent" under Privileged Gateway Intents

5. **Run the bot:**
   ```bash
   python bot.py
   ```

## Deployment

This bot is designed to run on [Render](https://render.com) for free 24/7 hosting.

See deployment instructions in the repo or contact the developer.

## Configuration

To change the time when facts are posted, edit this line in `bot.py`:
```python
@tasks.loop(time=time(hour=9, minute=0))  # Change hour and minute
```

## Technologies Used

- Python 3
- discord.py
- Useless Facts API
- Flask (for keeping bot alive on Render)

## How It Works

- Each server can set one channel to receive daily facts
- Settings are saved in `fact_channels.json`
- The bot posts to all registered channels at the scheduled time
- Multiple servers can use the same bot simultaneously

## License

MIT License - feel free to use and modify!

## Author

Created by minned

## Support

Need help? Open an issue on GitHub or use `!help` in Discord!