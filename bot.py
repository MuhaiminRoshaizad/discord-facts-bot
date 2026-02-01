import discord
from discord.ext import commands, tasks
from datetime import time
import pytz
import requests
import os
from dotenv import load_dotenv
import json

# load environment variables
load_dotenv()

# get token from .env file
TOKEN = os.getenv('DISCORD_TOKEN')

# setup timezone
MY_TIMEZONE = pytz.timezone('Asia/Kuala_Lumpur')

# convert 9:00 AM Malaysia Time = 1:00 AM UTC (9 - 8 = 1)
SCHEDULED_HOUR_UTC = 1  # 1 AM UTC = 9 AM Malaysia Time (UTC+8)
SCHEDULED_MINUTE_UTC = 0

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

# dictionary to store which channel to post to for each server
fact_channels = load_channels()

def get_random_fact():
    """Fetch a random fact from the Useless Facts API"""
    try:
        response = requests.get('https://uselessfacts.jsph.pl/api/v2/facts/random')
        data = response.json()
        fact = data['text']
        return f"**📚 Fact of the Day**\n\n{fact}"
    except Exception as e:
        print(f"Error fetching fact: {e}")
        return "**📚 Fact of the Day**\n\nDid you know? The first computer bug was an actual bug - a moth stuck in a computer in 1947!"

# schedule in utc since Railway runs in UTC
@tasks.loop(time=time(hour=SCHEDULED_HOUR_UTC, minute=SCHEDULED_MINUTE_UTC))
async def send_daily_fact():
    """Send daily fact to all registered channels at 9:00 AM Malaysia Time"""
    from datetime import datetime
    
    now_utc = datetime.now(pytz.UTC)
    now_myt = now_utc.astimezone(MY_TIMEZONE)
    
    print(f"🕐 Daily fact task triggered!")
    print(f"   UTC Time: {now_utc.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"   Malaysia Time: {now_myt.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"📊 Sending to {len(fact_channels)} channel(s)")
    
    for guild_id, channel_id in fact_channels.items():
        channel = bot.get_channel(int(channel_id))
        if channel:
            fact = get_random_fact()
            try:
                await channel.send(fact)
                print(f"✅ Sent daily fact to {channel.guild.name} - #{channel.name}")
            except Exception as e:
                print(f"❌ Error sending to channel {channel_id}: {e}")

@send_daily_fact.before_loop
async def before_daily_fact():
    """wait until the bot is ready before starting the loop"""
    await bot.wait_until_ready()
    from datetime import datetime
    
    now_utc = datetime.now(pytz.UTC)
    now_myt = now_utc.astimezone(MY_TIMEZONE)
    
    print("Daily fact task is ready!")
    print(f"⏰ Current UTC Time: {now_utc.strftime('%H:%M:%S')}")
    print(f"⏰ Current Malaysia Time: {now_myt.strftime('%H:%M:%S')}")
    print(f"⏰ Scheduled to run daily at {SCHEDULED_HOUR_UTC:02d}:{SCHEDULED_MINUTE_UTC:02d} UTC (9:00 AM Malaysia Time)")

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
    fact = get_random_fact()
    await ctx.send(fact)

@bot.command()
async def ping(ctx):
    """!ping cmd to check bot responsive or not"""
    await ctx.send(f'🏓 Pong! Latency: {round(bot.latency * 1000)}ms')

@bot.command()
async def checktime(ctx):
    """Check current time and scheduled time"""
    from datetime import datetime
    
    now_utc = datetime.now(pytz.UTC)
    now_myt = now_utc.astimezone(MY_TIMEZONE)
    
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
        value=f"**9:00 AM Malaysia Time** (1:00 AM UTC)\nRuns daily automatically",
        inline=False
    )
    
    await ctx.send(embed=embed)

@bot.command()
@commands.has_permissions(administrator=True)
async def setchannel(ctx):
    """Set this channel to receive daily facts - use !setchannel (Admin only)"""
    fact_channels[str(ctx.guild.id)] = str(ctx.channel.id)
    save_channels(fact_channels)
    await ctx.send(f"✅ Daily facts will now be posted in {ctx.channel.mention} at 9:00 AM Malaysia Time every day!")
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
    embed = discord.Embed(
        title="📚 Fact of the Day Bot - Help",
        description="A bot that sends interesting random facts every day!",
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
        value="Daily facts are posted at **9:00 AM Malaysia Time (UTC+8)** in channels set by server admins",
        inline=False
    )
    
    embed.set_footer(text="Created with ❤️ | Use !setchannel to get started!")
    await ctx.send(embed=embed)

@bot.command()
async def info(ctx):
    """Show information about bot setup in this server"""
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
        value="9:00 AM Malaysia Time (UTC+8) daily (if enabled)",
        inline=False
    )
    
    embed.set_footer(text="Need help? Use !bothelp")
    await ctx.send(embed=embed)

if __name__ == "__main__":
    bot.run(TOKEN)