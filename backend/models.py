from pydantic import BaseModel
from typing import Dict, List, Any, Optional

class CreateRoomRequest(BaseModel):
    is_public: bool = False
 
# 存储房间信息
# rooms = { "roomId": {"players": ["userId1"], "game_state": "waiting", "deck": [], "player_hands": {}} }
rooms: Dict[str, Dict[str, Any]] = {} 