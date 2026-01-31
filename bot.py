import discord
from discord.ext import commands, tasks
from datetime import time
import requests
import os
from dotenv import load_dotenv

# load environment variables
load_dotenv()

# get token and channel ID from .env file
TOKEN = os.getenv('DISCORD_TOKEN')
CHANNEL_ID = int(os.getenv('CHANNEL_ID'))

# setup bot
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

def get_random_fact():
    """Fetch a random fact from the Useless Facts API"""
    try:
        response = requests.get('https://uselessfacts.jsph.pl/api/v2/facts/random')
        data = response.json()
        fact = data['text']
        return f"**📚 Fact of the Day**\n\n{fact}"
    except Exception as e:
        print(f"Error fetching fact: {e}")
        return "**Fact of the Day**\n\nDid you know? The first computer bug was an actual bug - a moth stuck in a computer in 1947!"

@tasks.loop(time=time(hour=9, minute=0))  # Runs daily at 9:00 AM
async def send_daily_fact():
    """send the daily fact to specified channel from channel ID"""
    channel = bot.get_channel(CHANNEL_ID)
    if channel:
        fact = get_random_fact()
        await channel.send(fact)
        print(f"Sent daily fact at {discord.utils.utcnow()}")

@send_daily_fact.before_loop
async def before_daily_fact():
    """wait until the bot is ready before starting the loop"""
    await bot.wait_until_ready()
    print("Daily fact task is ready!")

@bot.event
async def on_ready():
    """console log when bot successfully connects"""
    print(f'✅ Bot is online! Logged in as {bot.user}')
    print(f'Bot ID: {bot.user.id}')
    print(f'Connected to {len(bot.guilds)} server(s)')
    send_daily_fact.start()

@bot.command()
async def fact(ctx):
    """!fact in Discord to get random facts"""
    fact = get_random_fact()
    await ctx.send(fact)

@bot.command()
async def ping(ctx):
    """!ping cmd to check bot responsive or nto"""
    await ctx.send(f'🏓 Pong! Latency: {round(bot.latency * 1000)}ms')


if __name__ == "__main__":
    bot.run(TOKEN)