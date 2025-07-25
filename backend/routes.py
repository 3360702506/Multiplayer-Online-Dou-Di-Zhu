from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import logging
import json
import asyncio
import random

from models import rooms, CreateRoomRequest
from connection_manager import manager
from game_logic import create_deck, generate_room_id, start_bidding, trigger_next_action

router = APIRouter()

# 大厅连接管理
lobby_connections = {}

@router.post("/api/create_room")
async def create_room(request: CreateRoomRequest):
    room_id = generate_room_id()
    while room_id in rooms:
        room_id = generate_room_id()
    
    rooms[room_id] = {
        "players": [],
        "player_names": {},
        "is_public": request.is_public,
        "websockets": {},
        "game_state": "waiting", # waiting, dealing, bidding, playing, finished
        "deck": [],
        "player_hands": {},
        "landlord_cards": [],
        "turn_index": -1,
        "bid_turn_index": -1,
        "landlord": None,
        "last_played_hand": [],
        "played_cards": [] # Add tracker for played cards
    }
    logging.info(f"创建了新房间: {room_id}, 是否公开: {request.is_public}")
    
    # 广播新房间信息给所有大厅连接
    if request.is_public:
        for connection in lobby_connections.values():
            try:
                await connection.send_text(json.dumps({
                    "type": "public_rooms_update",
                    "rooms": await get_public_rooms_list()
                }))
            except:
                pass
                
    return JSONResponse({"room_id": room_id})

async def get_public_rooms_list():
    public_rooms_list = []
    for room_id, room_data in rooms.items():
        if room_data.get("is_public") and room_data.get("game_state") == "waiting":
            public_rooms_list.append({
                "id": room_id,
                "players": len(room_data.get("players", [])),
                "max_players": 3
            })
    return public_rooms_list

@router.get("/api/public_rooms")
async def get_public_rooms():
    return JSONResponse(await get_public_rooms_list())

# 添加大厅WebSocket路由
@router.websocket("/ws/lobby/{user_id}")
async def lobby_websocket(websocket: WebSocket, user_id: str):
    await websocket.accept()
    lobby_connections[user_id] = websocket
    logging.info(f"用户 {user_id} 连接到大厅")
    
    try:
        # 发送当前公开房间列表
        await websocket.send_text(json.dumps({
            "type": "public_rooms",
            "rooms": await get_public_rooms_list()
        }))
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            action = message.get("action", message.get("type"))
            
            if action == "get_public_rooms":
                await websocket.send_text(json.dumps({
                    "type": "public_rooms",
                    "rooms": await get_public_rooms_list()
                }))
            
            elif action == "create_room":
                is_public = message.get("is_public", False)
                player_name = message.get("player_name", "玩家")
                room_id = generate_room_id()
                while room_id in rooms:
                    room_id = generate_room_id()
                
                rooms[room_id] = {
                    "players": [user_id],  # 自动将创建者添加为玩家
                    "player_names": {user_id: player_name},
                    "is_public": is_public,
                    "websockets": {},
                    "game_state": "waiting",
                    "deck": [],
                    "player_hands": {},
                    "landlord_cards": [],
                    "turn_index": -1,
                    "bid_turn_index": -1,
                    "landlord": None,
                    "last_played_hand": [],
                    "played_cards": []
                }
                logging.info(f"通过WebSocket创建了新房间: {room_id}, 是否公开: {is_public}")
                
                await websocket.send_text(json.dumps({
                    "type": "room_created",
                    "success": True,
                    "room_id": room_id
                }))
                
                # 广播新房间信息给所有大厅连接
                if is_public:
                    for conn_id, connection in lobby_connections.items():
                        try:
                            await connection.send_text(json.dumps({
                                "type": "public_rooms_update",
                                "rooms": await get_public_rooms_list()
                            }))
                        except:
                            pass
            
            elif action == "join_room":
                room_id = message.get("room_id")
                player_name = message.get("player_name", "玩家")
                if room_id in rooms:
                    room = rooms[room_id]
                    if len(room["players"]) < 3:
                        await websocket.send_text(json.dumps({
                            "type": "join_success",
                            "success": True,
                            "room_id": room_id
                        }))
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "房间已满"
                        }))
                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "房间不存在"
                    }))
    
    except WebSocketDisconnect:
        if user_id in lobby_connections:
            del lobby_connections[user_id]
        logging.info(f"用户 {user_id} 断开与大厅的连接")
    except Exception as e:
        logging.error(f"大厅WebSocket错误: {e}", exc_info=True)
        if user_id in lobby_connections:
            del lobby_connections[user_id]

@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    if room_id not in rooms:
        await websocket.close(code=1008)
        logging.warning(f"用户 {user_id} 尝试加入一个不存在的房间: {room_id}")
        return

    room = rooms.get(room_id)
    if not room:
        await websocket.close(code=1008)
        return
        
    await manager.connect(websocket, room_id)
    
    # Store websocket object with user_id for direct messaging
    if "websockets" not in room:
        room["websockets"] = {}
    room["websockets"][user_id] = websocket
    
    # 默认玩家名称
    player_name = "玩家"
    
    if user_id not in room["players"]:
        if len(room["players"]) < 3:
            room["players"].append(user_id)
            room["player_names"][user_id] = player_name
        else:
            await websocket.close(code=1011, reason="房间已满")
            logging.warning(f"用户 {user_id} 尝试加入已满的房间: {room_id}")
            return

    logging.info(f"用户 {user_id}({player_name}) 加入了房间 {room_id}")
    
    # Broadcast updated player list
    await manager.broadcast(json.dumps({
        "type": "player_update", 
        "players": room["players"], 
        "player_names": room["player_names"],
        "landlord": room.get("landlord")
    }), room_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            action = message.get("action")
            room = rooms.get(room_id)
            if not room: continue
            
            if action == "player_info":
                # 更新玩家名称
                player_name = message.get("player_name", "玩家")
                room["player_names"][user_id] = player_name
                logging.info(f"更新用户 {user_id} 的名称为 {player_name}")
                
                # 广播更新后的玩家列表
                await manager.broadcast(json.dumps({
                    "type": "player_update", 
                    "players": room["players"], 
                    "player_names": room["player_names"],
                    "landlord": room.get("landlord")
                }), room_id)

            elif action == "add_bot":
                if len(room["players"]) < 3:
                    bot_id = f"bot_{random.randint(100, 999)}"
                    bot_name = f"机器人{random.randint(100, 999)}"
                    room["players"].append(bot_id)
                    room["player_names"][bot_id] = bot_name
                    logging.info(f"机器人 {bot_id}({bot_name}) 加入了房间 {room_id}")
                    await manager.broadcast(json.dumps({
                        "type": "player_update", 
                        "players": room["players"], 
                        "player_names": room["player_names"],
                        "landlord": room.get("landlord")
                    }), room_id)

            elif action == "start_game":
                if len(room["players"]) == 3 and room["game_state"] == "waiting":
                    logging.info(f"房间 {room_id} 开始游戏")
                    room["game_state"] = "dealing"
                    
                    # 通知所有玩家游戏开始
                    await manager.broadcast(json.dumps({
                        "type": "game_started"
                    }), room_id)
                    
                    # 发牌
                    deck = create_deck()
                    
                    p1_hand, p2_hand, p3_hand = deck[0:17], deck[17:34], deck[34:51]
                    landlord_cards = deck[51:54]

                    # Assign hands to players, including bots
                    for i, player_id in enumerate(room["players"]):
                        hand = [p1_hand, p2_hand, p3_hand][i]
                        room["player_hands"][player_id] = hand
                        # If it's a human player, send them their hand
                        if "bot_" not in player_id:
                            player_ws = room["websockets"].get(player_id)
                            if player_ws:
                                await player_ws.send_text(json.dumps({"type": "deal", "hand": hand}))
                    
                    room["landlord_cards"] = landlord_cards
                    
                    # 更新游戏状态
                    await manager.broadcast(json.dumps({
                        "type": "game_state", 
                        "state": {
                            "game_state": room["game_state"],
                            "players": room["players"],
                            "landlord_cards": room["landlord_cards"],
                            "card_tracker": {}
                        }
                    }), room_id)
                    
                    # 开始叫地主
                    await start_bidding(room_id)
                else:
                    await websocket.send_text(json.dumps({"type": "error", "message": "需要3个玩家才能开始游戏"}))

            elif action == "bid":
                player_index = room["players"].index(user_id)
                if room["game_state"] == "bidding" and player_index == room["bid_turn_index"]:
                    choice = message.get("choice")
                    if choice == "bid":
                        room["game_state"] = "playing"
                        room["landlord"] = user_id
                        room["turn_index"] = player_index

                        logging.info(f"地主是 {user_id}")
                        
                        # 广播地主信息和底牌
                        await manager.broadcast(json.dumps({
                            "type": "landlord_decided",
                            "landlord": user_id,
                            "landlord_cards": room["landlord_cards"]
                        }), room_id)
                        
                        # 延迟一下，让前端有时间展示底牌
                        await asyncio.sleep(1.5)

                        # 添加底牌到地主手牌并排序
                        room["player_hands"][user_id].extend(room["landlord_cards"])
                        # 这里我们假设前端会自己排序，也可以在后端排序
                        
                        # 单独更新地主手牌
                        landlord_ws = room["websockets"].get(user_id)
                        if landlord_ws:
                            await landlord_ws.send_text(json.dumps({
                                "type": "update_hand",
                                "hand": room["player_hands"][user_id]
                            }))

                        await trigger_next_action(room_id)
                    else: # pass
                        await manager.broadcast(json.dumps({"type": "player_passed", "player": user_id, "action": "bid"}), room_id)
                        room["bid_turn_index"] = (room["bid_turn_index"] + 1) % 3
                        await trigger_next_action(room_id)

            elif action == "play":
                player_index = room["players"].index(user_id)
                if room["game_state"] == "playing" and player_index == room["turn_index"]:
                    cards_played = message.get("cards", [])
                    
                    # TODO: Add full validation logic here
                    # 1. Validate card combination
                    # 2. Validate against last played hand
                    
                    # Basic validation: does the player have these cards?
                    valid_play = all(card in room["player_hands"][user_id] for card in cards_played)
                    
                    if valid_play and cards_played:
                        # Remove cards from hand
                        new_hand = [c for c in room["player_hands"][user_id] if c not in cards_played]
                        room["player_hands"][user_id] = new_hand
                        
                        room["last_played_hand"] = cards_played
                        room["played_cards"].extend(cards_played) # Record played cards
                        
                        # 计算每个玩家的手牌数量
                        player_cards = {player_id: len(hand) for player_id, hand in room["player_hands"].items()}
                        
                        # Send updated hand back to the player
                        await websocket.send_text(json.dumps({
                            "type": "update_hand", 
                            "hand": new_hand
                        }))

                        await manager.broadcast(json.dumps({
                            "type": "cards_played",
                            "player": user_id,
                            "cards": cards_played,
                            "player_cards": player_cards
                        }), room_id)
                        
                        if not new_hand:
                            room["game_state"] = "finished"
                            await manager.broadcast(json.dumps({
                                "type": "game_over", 
                                "winner": user_id
                            }), room_id)
                            # TODO: Add logic to reset room
                        else:
                            room["turn_index"] = (room["turn_index"] + 1) % 3
                            await trigger_next_action(room_id)
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error", 
                            "message": "无效的出牌"
                        }))

            elif action == "pass":
                player_index = room["players"].index(user_id)
                if room["game_state"] == "playing" and player_index == room["turn_index"]:
                    await manager.broadcast(json.dumps({"type": "player_passed", "player": user_id, "action": "play"}), room_id)
                    room["turn_index"] = (room["turn_index"] + 1) % 3
                    await trigger_next_action(room_id)
            
            elif action == "chat":
                chat_message = message.get("message", "")
                player_name = room["player_names"].get(user_id, "玩家")
                if chat_message:
                    await manager.broadcast(json.dumps({
                        "type": "chat_message",
                        "sender_id": user_id,
                        "sender_name": player_name,
                        "message": chat_message
                    }), room_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        if user_id in room["websockets"]:
            del room["websockets"][user_id]
        if user_id in room["players"]:
            room["players"].remove(user_id)
            if user_id in room["player_names"]:
                del room["player_names"][user_id]
        logging.info(f"用户 {user_id} 离开了房间 {room_id}")
        
        # 检查房间是否为空或只有机器人
        has_human = False
        for player_id in room["players"]:
            if "bot_" not in player_id:
                has_human = True
                break
        
        # 如果房间为空或只有机器人，关闭房间
        if not has_human:
            logging.info(f"房间 {room_id} 没有真人玩家，即将关闭")
            if room_id in rooms:
                del rooms[room_id]
                return
        
        # 广播玩家列表更新
        await manager.broadcast(json.dumps({
            "type": "player_update", 
            "players": room["players"], 
            "player_names": room["player_names"],
            "landlord": room.get("landlord")
        }), room_id)
    except Exception as e:
        logging.error(f"WebSocket 出现错误: {e}", exc_info=True)
        # Clean up on error as well
        manager.disconnect(websocket, room_id)
        if user_id in room["websockets"]:
            del room["websockets"][user_id]
        if user_id in room["players"]:
            room["players"].remove(user_id)
            if user_id in room["player_names"]:
                del room["player_names"][user_id]
        
        # 检查房间是否为空或只有机器人
        has_human = False
        for player_id in room["players"]:
            if "bot_" not in player_id:
                has_human = True
                break
        
        # 如果房间为空或只有机器人，关闭房间
        if not has_human:
            logging.info(f"房间 {room_id} 没有真人玩家，即将关闭")
            if room_id in rooms:
                del rooms[room_id]
                return
                
        await manager.broadcast(json.dumps({
            "type": "player_update", 
            "players": room["players"], 
            "player_names": room["player_names"],
            "landlord": room.get("landlord")
        }), room_id) 