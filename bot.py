import discord
from discord.ext import commands, tasks
from datetime import datetime, time
import pytz
import requests
import os
from dotenv import load_dotenv
import json
import random
import re

# load environment variables
load_dotenv()

# get token from .env file
TOKEN = os.getenv('DISCORD_TOKEN')

# et Unsplash API key (free at https://unsplash.com/developers)
UNSPLASH_ACCESS_KEY = os.getenv('UNSPLASH_ACCESS_KEY', None)

# setup timezone
MY_TIMEZONE = pytz.timezone('Asia/Kuala_Lumpur')

# set the time (24 hour format) in Malaysia Time
SCHEDULED_HOUR_MYT = 18
SCHEDULED_MINUTE_MYT = 53

# auto convert UTC time
def get_utc_time_from_myt(hour, minute):
    """Convert Malaysia Time to UTC time automatically"""
    myt = MY_TIMEZONE.localize(datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0))
    utc = myt.astimezone(pytz.UTC)
    return utc.hour, utc.minute

SCHEDULED_HOUR_UTC, SCHEDULED_MINUTE_UTC = get_utc_time_from_myt(SCHEDULED_HOUR_MYT, SCHEDULED_MINUTE_MYT)

# setup bot
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# store channel id for each server
channels_file = 'fact_channels.json'

def load_channels():
    """Load saved channels from file"""
    try:
        with open(channels_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_channels(channels):
    """Save channels to file"""
    with open(channels_file, 'w') as f:
        json.dump(channels, f)

fact_channels = load_channels()

def extract_keywords(text):
    """Extract meaningful keywords from the fact text"""
    # Remove common words and extract nouns/important words
    common_words = {'the', 'a', 'an', 'is', 'was', 'are', 'were', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'that', 'this', 'it', 'and', 'or', 'but'}
    
    # Clean and split text
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    
    # Filter out common words
    keywords = [word for word in words if word not in common_words]
    
    # Return top 3 keywords
    return keywords[:3] if keywords else ['nature', 'science', 'world']

def get_image_for_fact(fact_text):
    """Get a relevant image from Unsplash based on fact keywords"""
    if not UNSPLASH_ACCESS_KEY:
        # Return a nice fallback image if no API key
        fallback_images = [
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800",  # Earth/Space
            "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800",  # Books
            "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800",  # Nature
            "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800",  # Galaxy
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",  # Technology
        ]
        return random.choice(fallback_images)
    
    try:
        keywords = extract_keywords(fact_text)
        query = ' '.join(keywords)
        
        url = f"https://api.unsplash.com/photos/random"
        params = {
            'query': query,
            'client_id': UNSPLASH_ACCESS_KEY,
            'orientation': 'landscape'
        }
        
        response = requests.get(url, params=params, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return data['urls']['regular']
        else:
            # Fallback
            return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800"
    except Exception as e:
        print(f"Error fetching image: {e}")
        return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800"

def get_random_fact():
    """Fetch a random fact from the Useless Facts API"""
    try:
        response = requests.get('https://uselessfacts.jsph.pl/api/v2/facts/random', timeout=5)
        data = response.json()
        return data['text']
    except Exception as e:
        print(f"Error fetching fact: {e}")
        return "The first computer bug was an actual bug - a moth stuck in a computer in 1947!"

def create_fact_embed(fact_text):
    """Create a beautiful embed with image for the fact"""
    
    # Different themes for variety
    themes = [
        {"emoji": "🧠", "title": "Brain Food", "color": 0x9B59B6},
        {"emoji": "💡", "title": "Bright Idea", "color": 0xF1C40F},
        {"emoji": "🌟", "title": "Fun Fact", "color": 0x3498DB},
        {"emoji": "📚", "title": "Did You Know?", "color": 0x1ABC9C},
        {"emoji": "🔍", "title": "Interesting Discovery", "color": 0x2ECC71},
        {"emoji": "🎯", "title": "Random Fact", "color": 0xE74C3C},
        {"emoji": "✨", "title": "Amazing Fact", "color": 0xE67E22},
    ]
    
    theme = random.choice(themes)
    
    embed = discord.Embed(
        title=f"{theme['emoji']} {theme['title']}",
        description=f"*{fact_text}*",
        color=theme['color'],
        timestamp=datetime.now(pytz.UTC)
    )
    
    # Get relevant image
    image_url = get_image_for_fact(fact_text)
    embed.set_image(url=image_url)
    
    embed.set_footer(
        text="💭 Daily Fact • Use !fact for more • Photo by Unsplash",
        icon_url="https://em-content.zobj.net/thumbs/120/twitter/348/open-book_1f4d6.png"
    )
    
    return embed

# schedule in utc since Railway runs in UTC
@tasks.loop(time=time(hour=SCHEDULED_HOUR_UTC, minute=SCHEDULED_MINUTE_UTC))
async def send_daily_fact():
    """Send daily fact to all registered channels"""
    now_utc = datetime.now(pytz.UTC)
    now_myt = now_utc.astimezone(MY_TIMEZONE)
    
    print(f"🕐 Daily fact task triggered!")
    print(f"   UTC Time: {now_utc.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"   Malaysia Time: {now_myt.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"📊 Sending to {len(fact_channels)} channel(s)")
    
    fact_text = get_random_fact()
    fact_embed = create_fact_embed(fact_text)
    
    for guild_id, channel_id in fact_channels.items():
        channel = bot.get_channel(int(channel_id))
        if channel:
            try:
                message = await channel.send(embed=fact_embed)
                # Add reactions for engagement
                await message.add_reaction("🤯")
                await message.add_reaction("💡")
                await message.add_reaction("❤️")
                print(f"✅ Sent daily fact to {channel.guild.name} - #{channel.name}")
            except Exception as e:
                print(f"❌ Error sending to channel {channel_id}: {e}")

@send_daily_fact.before_loop
async def before_daily_fact():
    """wait until the bot is ready before starting the loop"""
    await bot.wait_until_ready()
    
    now_utc = datetime.now(pytz.UTC)
    now_myt = now_utc.astimezone(MY_TIMEZONE)
    
    print("Daily fact task is ready!")
    print(f"⏰ Current UTC Time: {now_utc.strftime('%H:%M:%S')}")
    print(f"⏰ Current Malaysia Time: {now_myt.strftime('%H:%M:%S')}")
    print(f"⏰ Scheduled to run at {SCHEDULED_HOUR_MYT:02d}:{SCHEDULED_MINUTE_MYT:02d} Malaysia Time ({SCHEDULED_HOUR_UTC:02d}:{SCHEDULED_MINUTE_UTC:02d} UTC)")

@bot.event
async def on_ready():
    """console log when bot successfully connects"""
    print(f'✅ Bot is online! Logged in as {bot.user}')
    print(f'Bot ID: {bot.user.id}')
    print(f'Connected to {len(bot.guilds)} server(s)')
    print(f'Currently posting to {len(fact_channels)} channel(s)')
    send_daily_fact.start()

@bot.command()
async def fact(ctx):
    """!fact in Discord to get random facts"""
    fact_text = get_random_fact()
    fact_embed = create_fact_embed(fact_text)
    message = await ctx.send(embed=fact_embed)
    await message.add_reaction("🤯")
    await message.add_reaction("💡")

@bot.command()
async def ping(ctx):
    """!ping cmd to check bot responsive or not"""
    await ctx.send(f'🏓 Pong! Latency: {round(bot.latency * 1000)}ms')

@bot.command()
async def checktime(ctx):
    """Check current time and scheduled time"""
    now_utc = datetime.now(pytz.UTC)
    now_myt = now_utc.astimezone(MY_TIMEZONE)
    
    scheduled_time_12h = datetime.strptime(f"{SCHEDULED_HOUR_MYT}:{SCHEDULED_MINUTE_MYT}", "%H:%M").strftime("%I:%M %p")
    
    embed = discord.Embed(
        title="🕐 Bot Time Information",
        color=discord.Color.blue()
    )
    
    embed.add_field(
        name="Current UTC Time",
        value=now_utc.strftime('%Y-%m-%d %H:%M:%S %Z'),
        inline=False
    )
    
    embed.add_field(
        name="Current Malaysia Time",
        value=now_myt.strftime('%Y-%m-%d %H:%M:%S %Z'),
        inline=False
    )
    
    embed.add_field(
        name="📅 Scheduled Post Time",
        value=f"**{scheduled_time_12h} Malaysia Time**\n({SCHEDULED_HOUR_UTC:02d}:{SCHEDULED_MINUTE_UTC:02d} UTC)\nRuns daily automatically",
        inline=False
    )
    
    await ctx.send(embed=embed)

@bot.command()
@commands.has_permissions(administrator=True)
async def setchannel(ctx):
    """Set this channel to receive daily facts - use !setchannel (Admin only)"""
    scheduled_time_12h = datetime.strptime(f"{SCHEDULED_HOUR_MYT}:{SCHEDULED_MINUTE_MYT}", "%H:%M").strftime("%I:%M %p")
    
    fact_channels[str(ctx.guild.id)] = str(ctx.channel.id)
    save_channels(fact_channels)
    await ctx.send(f"✅ Daily facts will now be posted in {ctx.channel.mention} at {scheduled_time_12h} Malaysia Time every day!")
    print(f"✅ Channel set for {ctx.guild.name}: #{ctx.channel.name}")

@bot.command()
@commands.has_permissions(administrator=True)
async def removechannel(ctx):
    """Stop daily facts in this server - use !removechannel (Admin only)"""
    if str(ctx.guild.id) in fact_channels:
        del fact_channels[str(ctx.guild.id)]
        save_channels(fact_channels)
        await ctx.send("✅ Daily facts have been disabled for this server.")
        print(f"✅ Channel removed for {ctx.guild.name}")
    else:
        await ctx.send("❌ Daily facts are not currently enabled in this server.")

@bot.command()
async def bothelp(ctx):
    """Show all available commands and bot information"""
    scheduled_time_12h = datetime.strptime(f"{SCHEDULED_HOUR_MYT}:{SCHEDULED_MINUTE_MYT}", "%H:%M").strftime("%I:%M %p")
    
    embed = discord.Embed(
        title="📚 Fact of the Day Bot - Help",
        description="A bot that sends interesting random facts with beautiful images every day!",
        color=discord.Color.blue()
    )
    
    embed.add_field(
        name="📖 User Commands", 
        value=(
            "`!fact` - Get a random fact right now\n"
            "`!ping` - Check if bot is online\n"
            "`!checktime` - Check current bot time\n"
            "`!bothelp` - Show this help message\n"
            "`!info` - Show bot setup info"
        ), 
        inline=False
    )
    
    embed.add_field(
        name="⚙️ Admin Commands", 
        value=(
            "`!setchannel` - Enable daily facts in this channel\n"
            "`!removechannel` - Disable daily facts in this server"
        ), 
        inline=False
    )
    
    embed.add_field(
        name="⏰ Automatic Feature", 
        value=f"Daily facts are posted at **{scheduled_time_12h} Malaysia Time (UTC+8)** in channels set by server admins",
        inline=False
    )
    
    embed.set_footer(text="Created with ❤️ | Use !setchannel to get started!")
    await ctx.send(embed=embed)

@bot.command()
async def info(ctx):
    """Show information about bot setup in this server"""
    scheduled_time_12h = datetime.strptime(f"{SCHEDULED_HOUR_MYT}:{SCHEDULED_MINUTE_MYT}", "%H:%M").strftime("%I:%M %p")
    
    embed = discord.Embed(
        title="📚 Bot Setup Info",
        description=f"Information for **{ctx.guild.name}**",
        color=discord.Color.green()
    )
    
    if str(ctx.guild.id) in fact_channels:
        channel = bot.get_channel(int(fact_channels[str(ctx.guild.id)]))
        if channel:
            embed.add_field(
                name="✅ Daily Facts Status", 
                value=f"**Enabled** in {channel.mention}", 
                inline=False
            )
        else:
            embed.add_field(
                name="⚠️ Daily Facts Status", 
                value="Enabled but channel not found", 
                inline=False
            )
    else:
        embed.add_field(
            name="❌ Daily Facts Status", 
            value="Not enabled - Ask an admin to use `!setchannel`", 
            inline=False
        )
    
    embed.add_field(
        name="⏰ Posting Time", 
        value=f"{scheduled_time_12h} Malaysia Time (UTC+8) daily (if enabled)",
        inline=False
    )
    
    embed.set_footer(text="Need help? Use !bothelp")
    await ctx.send(embed=embed)

if __name__ == "__main__":
    bot.run(TOKEN)