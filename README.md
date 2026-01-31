# Discord Fact of the Day Bot 

A Discord bot that automatically sends a random interesting fact every day!

## Features

- Automatically posts a fact daily at 9:00 AM
- Uses the Useless Facts API for random facts
- Manual command `!fact` to get a fact anytime
- Ping command to check bot status

## Setup Instructions

### Prerequisites
- Python 3.10 or higher
- A Discord account
- A Discord server where you have admin permissions

### Installation

1. **Clone this repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/discord-fact-bot.git
   cd discord-fact-bot
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create a `.env` file:**
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CHANNEL_ID=your_channel_id_here
   ```

4. **Get your Discord bot token:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" tab and create a bot
   - Copy the token and paste it in `.env`
   - Enable "Message Content Intent" under Privileged Gateway Intents

5. **Get your channel ID:**
   - Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
   - Right-click the channel where you want facts posted
   - Click "Copy Channel ID" and paste it in `.env`

6. **Run the bot:**
   ```bash
   python bot.py
   ```

## Commands

- `!fact` - Get a random fact immediately
- `!ping` - Check if the bot is online

## Configuration

To change the time when facts are posted, edit this line in `bot.py`:
```python
@tasks.loop(time=time(hour=9, minute=0))  # Change hour and minute
```

## Technologies Used

- Python 3
- discord.py
- Useless Facts API

## License

MIT License - feel free to use and modify!

## Author

Created by minned