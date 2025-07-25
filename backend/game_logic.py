import random
import asyncio
import json
import logging
from models import rooms

# 牌面值映射
CARD_VALUES = {
    "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14, "2": 15,
    "Black": 16, "Red": 17  # 小王和大王
}

# 牌型定义
CARD_TYPE = {
    "SINGLE": 1,        # 单牌
    "PAIR": 2,          # 对子
    "TRIO": 3,          # 三张
    "TRIO_WITH_SINGLE": 4,  # 三带一
    "TRIO_WITH_PAIR": 5,    # 三带二
    "STRAIGHT": 6,      # 顺子(五张或更多)
    "STRAIGHT_PAIR": 7, # 连对(三对或更多)
    "PLANE": 8,         # 飞机(两组或更多三张)
    "PLANE_WITH_WINGS": 9,  # 飞机带翅膀
    "BOMB": 10,         # 炸弹
    "ROCKET": 11,       # 王炸
    "FOUR_WITH_TWO": 12 # 四带二
}

# 创建一副牌
def create_deck():
    suits = ["♠", "♥", "♣", "♦"]
    ranks = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"]
    
    # 创建普通牌
    cards = []
    for suit in suits:
        for rank in ranks:
            cards.append({"suit": suit, "rank": rank})
    
    # 添加大小王
    cards.append({"suit": "Joker", "rank": "Black"})
    cards.append({"suit": "Joker", "rank": "Red"})
    
    # 洗牌
    random.shuffle(cards)
    return cards

# 生成房间ID
def generate_room_id():
    return f"room_{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))}"

# 获取牌的类型和值
def get_card_type(cards):
    if not cards:
        return None, 0
    
    # 统计每个点数的牌数量
    counts = {}
    for card in cards:
        rank = card.get("rank")
        if rank in counts:
            counts[rank] += 1
        else:
            counts[rank] = 1
    
    # 获取点数及其出现次数
    rank_counts = [(rank, count) for rank, count in counts.items()]
    rank_counts.sort(key=lambda x: (-x[1], -CARD_VALUES.get(x[0], 0)))  # 按数量降序，同数量按点数降序
    
    # 王炸判断
    if len(cards) == 2 and "Red" in counts and "Black" in counts:
        return CARD_TYPE["ROCKET"], 0
    
    # 炸弹判断
    if len(cards) == 4 and len(counts) == 1:
        return CARD_TYPE["BOMB"], CARD_VALUES.get(cards[0].get("rank"), 0)
    
    # 单牌判断
    if len(cards) == 1:
        return CARD_TYPE["SINGLE"], CARD_VALUES.get(cards[0].get("rank"), 0)
    
    # 对子判断
    if len(cards) == 2 and len(counts) == 1:
        return CARD_TYPE["PAIR"], CARD_VALUES.get(cards[0].get("rank"), 0)
    
    # 三张判断
    if len(cards) == 3 and len(counts) == 1:
        return CARD_TYPE["TRIO"], CARD_VALUES.get(cards[0].get("rank"), 0)
    
    # 三带一判断
    if len(cards) == 4 and len(counts) == 2 and rank_counts[0][1] == 3:
        return CARD_TYPE["TRIO_WITH_SINGLE"], CARD_VALUES.get(rank_counts[0][0], 0)
    
    # 三带二判断
    if len(cards) == 5 and len(counts) == 2 and rank_counts[0][1] == 3 and rank_counts[1][1] == 2:
        return CARD_TYPE["TRIO_WITH_PAIR"], CARD_VALUES.get(rank_counts[0][0], 0)
    
    # 顺子判断
    if len(cards) >= 5 and len(counts) == len(cards):
        # 顺子不能包含2和王
        if "2" in counts or "Red" in counts or "Black" in counts:
            return None, 0
        
        # 检查是否连续
        values = [CARD_VALUES.get(card.get("rank"), 0) for card in cards]
        values.sort()
        if values[-1] - values[0] == len(values) - 1 and len(set(values)) == len(values):
            return CARD_TYPE["STRAIGHT"], values[0]
    
    # 连对判断
    if len(cards) >= 6 and len(cards) % 2 == 0 and len(counts) == len(cards) // 2:
        # 所有牌都是对子
        if all(count == 2 for _, count in counts.items()):
            # 检查是否连续
            ranks = list(counts.keys())
            values = [CARD_VALUES.get(rank, 0) for rank in ranks]
            values.sort()
            # 连对不能包含2
            if "2" not in counts and values[-1] - values[0] == len(values) - 1 and len(set(values)) == len(values):
                return CARD_TYPE["STRAIGHT_PAIR"], values[0]
    
    # 飞机判断
    if len(cards) >= 6 and len(cards) % 3 == 0:
        trio_ranks = [rank for rank, count in counts.items() if count == 3]
        if len(trio_ranks) == len(cards) // 3:
            # 检查三张是否连续
            trio_values = [CARD_VALUES.get(rank, 0) for rank in trio_ranks]
            trio_values.sort()
            if trio_values[-1] - trio_values[0] == len(trio_values) - 1 and len(set(trio_values)) == len(trio_values):
                return CARD_TYPE["PLANE"], trio_values[0]
    
    # 飞机带翅膀判断
    if len(cards) >= 8 and len(cards) % 4 == 0:
        trio_ranks = [rank for rank, count in counts.items() if count == 3]
        if len(trio_ranks) == len(cards) // 4:
            # 检查三张是否连续
            trio_values = [CARD_VALUES.get(rank, 0) for rank in trio_ranks]
            trio_values.sort()
            if trio_values[-1] - trio_values[0] == len(trio_values) - 1 and len(set(trio_values)) == len(trio_values):
                return CARD_TYPE["PLANE_WITH_WINGS"], trio_values[0]
    
    # 四带二判断
    if len(cards) == 6:
        four_ranks = [rank for rank, count in counts.items() if count == 4]
        if len(four_ranks) == 1:
            return CARD_TYPE["FOUR_WITH_TWO"], CARD_VALUES.get(four_ranks[0], 0)
    
    return None, 0

# 检查出牌是否有效
def is_valid_play(cards_to_play, last_played_cards):
    # 如果是第一次出牌或者上一轮所有人都不要
    if not last_played_cards:
        card_type, _ = get_card_type(cards_to_play)
        return card_type is not None
    
    # 获取当前出牌和上一次出牌的类型和值
    current_type, current_value = get_card_type(cards_to_play)
    last_type, last_value = get_card_type(last_played_cards)
    
    # 如果当前出牌无效
    if current_type is None:
        return False
    
    # 王炸可以打任何牌
    if current_type == CARD_TYPE["ROCKET"]:
        return True
    
    # 炸弹可以打任何非王炸的牌
    if current_type == CARD_TYPE["BOMB"]:
        if last_type == CARD_TYPE["ROCKET"]:
            return False
        if last_type == CARD_TYPE["BOMB"]:
            return current_value > last_value
        return True
    
    # 其他情况必须牌型相同且点数更大
    if current_type == last_type:
        # 对于相同牌型，比较点数
        if len(cards_to_play) == len(last_played_cards):
            return current_value > last_value
    
    return False

# 机器人行动
async def run_bot_action(room_id, bot_id):
    room = rooms.get(room_id)
    if not room:
        return
    
    # 模拟思考时间
    await asyncio.sleep(random.uniform(1, 2.5))
    
    if room["game_state"] == "bidding":
        # 机器人叫地主策略：50%概率叫地主
        if random.random() < 0.5:
            room["game_state"] = "playing"
            room["landlord"] = bot_id
            room["turn_index"] = room["players"].index(bot_id)
            
            # 广播地主信息和底牌
            from connection_manager import manager
            await manager.broadcast(json.dumps({
                "type": "landlord_decided",
                "landlord": bot_id,
                "landlord_cards": room["landlord_cards"]
            }), room_id)
            
            # 添加底牌到地主手牌
            room["player_hands"][bot_id].extend(room["landlord_cards"])
            
            # 延迟一下再开始出牌
            await asyncio.sleep(1.5)
            await trigger_next_action(room_id)
        else:
            # 不叫地主
            from connection_manager import manager
            await manager.broadcast(json.dumps({
                "type": "player_passed", 
                "player": bot_id, 
                "action": "bid"
            }), room_id)
            
            room["bid_turn_index"] = (room["bid_turn_index"] + 1) % 3
            await trigger_next_action(room_id)
    
    elif room["game_state"] == "playing":
        # 简单的机器人出牌策略
        bot_hand = room["player_hands"].get(bot_id, [])
        
        if not bot_hand:
            # 没牌了，游戏结束
            room["game_state"] = "finished"
            from connection_manager import manager
            await manager.broadcast(json.dumps({
                "type": "game_over", 
                "winner": bot_id
            }), room_id)
            return
        
        # 获取上一次出牌
        last_played = room.get("last_played_hand", [])
        
        # 如果是开局或者上一个出牌的是自己，可以任意出牌
        if not last_played or room.get("last_played_by") == bot_id:
            # 随机出一张牌
            card_to_play = random.choice(bot_hand)
            cards_played = [card_to_play]
            
            # 移除出的牌
            bot_hand.remove(card_to_play)
            room["player_hands"][bot_id] = bot_hand
            room["last_played_hand"] = cards_played
            room["last_played_by"] = bot_id
            room["played_cards"].extend(cards_played)
            
            # 广播出牌信息
            from connection_manager import manager
            await manager.broadcast(json.dumps({
                "type": "cards_played",
                "player": bot_id,
                "cards": cards_played,
                "player_cards": {player_id: len(hand) for player_id, hand in room["player_hands"].items()}
            }), room_id)
        else:
            # 尝试找到能打过上家的牌
            valid_plays = []
            
            # 简单策略：单牌对单牌，对子对对子
            if len(last_played) == 1:
                for card in bot_hand:
                    if is_valid_play([card], last_played):
                        valid_plays.append([card])
            elif len(last_played) == 2 and get_card_type(last_played)[0] == CARD_TYPE["PAIR"]:
                # 找对子
                counts = {}
                for card in bot_hand:
                    rank = card.get("rank")
                    if rank in counts:
                        counts[rank].append(card)
                    else:
                        counts[rank] = [card]
                
                for rank, cards in counts.items():
                    if len(cards) >= 2:
                        pair = cards[:2]
                        if is_valid_play(pair, last_played):
                            valid_plays.append(pair)
            
            # 如果找到有效的出牌
            if valid_plays:
                # 随机选择一个有效出牌
                cards_played = random.choice(valid_plays)
                
                # 移除出的牌
                for card in cards_played:
                    bot_hand.remove(card)
                
                room["player_hands"][bot_id] = bot_hand
                room["last_played_hand"] = cards_played
                room["last_played_by"] = bot_id
                room["played_cards"].extend(cards_played)
                
                # 广播出牌信息
                from connection_manager import manager
                await manager.broadcast(json.dumps({
                    "type": "cards_played",
                    "player": bot_id,
                    "cards": cards_played,
                    "player_cards": {player_id: len(hand) for player_id, hand in room["player_hands"].items()}
                }), room_id)
            else:
                # 不出
                from connection_manager import manager
                await manager.broadcast(json.dumps({
                    "type": "player_passed", 
                    "player": bot_id, 
                    "action": "play"
                }), room_id)
        
        if not bot_hand:
            # 没牌了，游戏结束
            room["game_state"] = "finished"
            from connection_manager import manager
            await manager.broadcast(json.dumps({
                "type": "game_over", 
                "winner": bot_id
            }), room_id)
            return
        
        # 轮到下一个玩家
        room["turn_index"] = (room["turn_index"] + 1) % 3
        await trigger_next_action(room_id)

# 触发下一个动作
async def trigger_next_action(room_id):
    room = rooms.get(room_id)
    if not room:
        return
    
    if room["game_state"] == "bidding":
        current_player = room["players"][room["bid_turn_index"]]
        
        if current_player.startswith("bot_"):
            # 机器人行动
            await run_bot_action(room_id, current_player)
        else:
            # 通知玩家轮到他叫地主
            player_ws = room["websockets"].get(current_player)
            if player_ws:
                await player_ws.send_text(json.dumps({
                    "type": "your_turn_to_bid"
                }))
    
    elif room["game_state"] == "playing":
        current_player = room["players"][room["turn_index"]]
        
        if current_player.startswith("bot_"):
            # 机器人行动
            await run_bot_action(room_id, current_player)
        else:
            # 通知玩家轮到他出牌
            player_ws = room["websockets"].get(current_player)
            if player_ws:
                await player_ws.send_text(json.dumps({
                    "type": "your_turn_to_play"
                }))

# 开始叫地主
async def start_bidding(room_id):
    room = rooms.get(room_id)
    if not room:
        return
    
    # 随机选择一个玩家开始叫地主
    room["game_state"] = "bidding"
    room["bid_turn_index"] = random.randint(0, 2)
    
    # 广播叫地主开始
    from connection_manager import manager
    await manager.broadcast(json.dumps({
        "type": "bidding_started",
        "start_player": room["players"][room["bid_turn_index"]]
    }), room_id)
    
    # 触发第一个玩家的叫地主动作
    await trigger_next_action(room_id) 