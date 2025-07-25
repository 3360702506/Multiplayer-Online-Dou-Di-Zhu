import random
import string
import json
import asyncio
import logging
from typing import List, Dict, Any

from connection_manager import manager
from models import rooms

# 卡牌定义
SUITS = ['♠', '♥', '♣', '♦']
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
SPECIAL_CARDS = [{'suit': 'Joker', 'rank': 'Red'}, {'suit': 'Joker', 'rank': 'Black'}]

def create_deck():
    """创建并洗牌"""
    deck = [{'suit': suit, 'rank': rank} for suit in SUITS for rank in RANKS]
    deck.extend(SPECIAL_CARDS)
    random.shuffle(deck)
    return deck

def generate_room_id(length=6):
    """生成一个随机的房间号"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

async def run_bot_action(room_id: str):
    """执行机器人的行动逻辑"""
    await asyncio.sleep(1) # 模拟思考
    room = rooms.get(room_id)
    if not room: return

    bot_id = None
    action_to_perform = None

    if room["game_state"] == "bidding":
        if room["bid_turn_index"] != -1:
            bot_id = room["players"][room["bid_turn_index"]]
            action_to_perform = "pass_bid"
    elif room["game_state"] == "playing":
        if room["turn_index"] != -1:
            bot_id = room["players"][room["turn_index"]]
            action_to_perform = "pass_play"

    if not bot_id or "bot_" not in bot_id:
        return
    
    logging.info(f"执行机器人 {bot_id} 的行动: {action_to_perform}")

    if action_to_perform == "pass_bid":
        # 机器人总是"不叫"
        await manager.broadcast(json.dumps({"type": "player_passed", "player": bot_id, "action": "bid"}), room_id)
        room["bid_turn_index"] = (room["bid_turn_index"] + 1) % 3
        # TODO: Handle case where everyone passes
        await trigger_next_action(room_id)

    elif action_to_perform == "pass_play":
        # 机器人总是"不要"
        await manager.broadcast(json.dumps({"type": "player_passed", "player": bot_id, "action": "play"}), room_id)
        room["turn_index"] = (room["turn_index"] + 1) % 3
        await trigger_next_action(room_id)

async def trigger_next_action(room_id: str):
    """检查当前轮次的玩家是真人还是机器人，并触发相应行动"""
    room = rooms.get(room_id)
    if not room: return

    next_player_id = None
    next_action_type = None

    if room["game_state"] == "bidding":
        turn_index = room.get("bid_turn_index", -1)
        if turn_index != -1:
            next_player_id = room["players"][turn_index]
            next_action_type = "your_turn_to_bid"

    elif room["game_state"] == "playing":
        turn_index = room.get("turn_index", -1)
        if turn_index != -1:
            next_player_id = room["players"][turn_index]
            next_action_type = "your_turn_to_play"

    if not next_player_id:
        return

    if "bot_" in next_player_id:
        asyncio.create_task(run_bot_action(room_id))
    else:
        player_ws = room["websockets"].get(next_player_id)
        if player_ws:
            await player_ws.send_text(json.dumps({"type": next_action_type}))

async def start_bidding(room_id: str):
    """开始叫地主阶段"""
    room = rooms[room_id]
    room["game_state"] = "bidding"
    room["bid_turn_index"] = random.randint(0, 2)
    bidder_id = room["players"][room["bid_turn_index"]]
    
    logging.info(f"房间 {room_id} 开始叫地主，轮到 {bidder_id}")
    await manager.broadcast(json.dumps({"type": "bidding_started", "start_player": bidder_id}), room_id)
    await trigger_next_action(room_id) 