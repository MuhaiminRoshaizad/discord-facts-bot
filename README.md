# Discord Fact of the Day Bot 📚

A Discord bot that automatically sends a random interesting fact every day to your server!

## ✨ Features

- 🤖 Automatically posts facts daily at 9:00 AM (Malaysia Time - UTC+8)
- 🌍 Works on multiple Discord servers
- ⚙️ Server admins choose which channel receives daily facts
- 📖 Get facts on-demand with `!fact` command
- 🏓 Check bot status with `!ping`
- 💾 Remembers your settings automatically
- 📊 Beautiful embed messages
- ☁️ Runs 24/7 - always online!

---

## 🚀 Quick Start

### **Step 1: Invite the Bot**

Click here to add the bot to your server:

👉 **[Invite Bot to Your Server](https://discord.com/oauth2/authorize?client_id=1467015114032152586&permissions=84992&integration_type=0&scope=bot)** 👈

> **Note:** You need "Manage Server" permission to add bots.

### **Step 2: Set Up Daily Facts**

1. Go to the channel where you want daily facts
2. Type: `!setchannel`
3. Done! 🎉

You'll now get a random fact every day at 9:00 AM Malaysia Time!

---

## 📚 Commands

### 👥 **Everyone Can Use:**

| Command | Description |
|---------|-------------|
| `!fact` | Get a random fact right now |
| `!ping` | Check if the bot is online |
| `!bothelp` | Show all commands |
| `!info` | See if daily facts are enabled in this server |

### 🔧 **Admin Only (Requires Administrator Permission):**

| Command | Description |
|---------|-------------|
| `!setchannel` | Enable daily facts in the current channel |
| `!removechannel` | Stop daily facts in this server |

---

## 🕐 When Are Facts Sent?

Daily facts are posted at **9:00 AM Malaysia Time (UTC+8)**, which is:

- 🇲🇾 Malaysia/Singapore: **9:00 AM**
- 🇬🇧 London (GMT): **1:00 AM**
- 🇺🇸 New York (EST): **8:00 PM** (previous day)
- 🇺🇸 Los Angeles (PST): **5:00 PM** (previous day)

---

## ❓ FAQ

### **Q: How do I change which channel gets facts?**
A: Just run `!setchannel` in the new channel. The bot will switch to that channel.

### **Q: Can I get facts in multiple channels?**
A: Currently, only one channel per server is supported.

### **Q: The bot isn't responding to commands. What's wrong?**
A: Make sure:
- The bot has permission to read and send messages in that channel
- You're typing the `!` prefix correctly

### **Q: Can I change the time when facts are sent?**
A: Not yet! But this feature may be added in the future.

### **Q: Where do the facts come from?**
A: Facts are fetched from the [Useless Facts API](https://uselessfacts.jsph.pl/).

---

## 🛡️ Permissions Needed

The bot needs these permissions:
- ✅ Read Messages/View Channels
- ✅ Send Messages
- ✅ Embed Links

These are automatically included in the invite link!

---

## 🐛 Issues or Suggestions?

- Found a bug? [Open an issue on GitHub](https://github.com/MuhaiminRoshaizad/discord-facts-bot/issues)
- Have an idea? Let me know!

---

## 👨‍💻 For Developers

Want to run your own instance or contribute to the code?

<details>
<summary><b>Click here for developer setup instructions</b></summary>

### Prerequisites
- Python 3.10 or higher
- A Discord Bot Token
- Railway account (or any cloud platform)

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MuhaiminRoshaizad/discord-facts-bot.git
   cd discord-facts-bot
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env` file:**
   ```env
   DISCORD_TOKEN=your_bot_token_here
   ```

4. **Run the bot:**
   ```bash
   python bot.py
   ```

### Changing Timezone

Edit `bot.py` line 16:
```python
MY_TIMEZONE = pytz.timezone('Asia/Kuala_Lumpur')  # Change this
```

[List of all timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

### Project Structure
```
discord-facts-bot/
├── bot.py                 # Main bot code
├── requirements.txt       # Dependencies
├── Procfile              # Deployment config
├── .env                  # Environment variables
└── fact_channels.json    # Stores server settings
```

### Technologies
- **discord.py** - Discord API
- **requests** - HTTP requests
- **python-dotenv** - Environment variables
- **pytz** - Timezone handling
- **Railway** - Cloud hosting

### Contributing
Pull requests are welcome! Ideas:
- Slash commands support
- Custom posting times per server
- Fact categories
- Multi-language support

</details>

---

## 📜 License

MIT License - Feel free to use and modify!

---

Made by [MuhaiminRoshaizad](https://github.com/MuhaiminRoshaizad)

**⭐ Star this repo if you find it useful!**