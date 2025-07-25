document.addEventListener('DOMContentLoaded', () => {
    // --- 元素获取 ---
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomIdInput = document.getElementById('room-id-input');
    const playerNameInput = document.getElementById('player-name-input');
    const isPublicCheckbox = document.getElementById('is-public-checkbox');
    const publicRoomsList = document.getElementById('public-rooms-list');

    // --- 状态变量 ---
    let websocket = null;
    let userId = 'user_' + Math.random().toString(36).substr(2, 9);
    let publicRoomsInterval;
    
    // 设置默认玩家名称
    const defaultNames = ['快乐玩家', '斗地主高手', '欢乐斗地主', '牌神', '地主', '农民', '牌王'];
    playerNameInput.value = defaultNames[Math.floor(Math.random() * defaultNames.length)] + Math.floor(Math.random() * 100);

    // 初始化WebSocket连接
    function initWebSocket() {
        // 修改WebSocket地址，使用大厅路由
        websocket = new WebSocket(`ws://localhost:8000/ws/lobby/${userId}`);
        
        websocket.onopen = () => {
            console.log('WebSocket连接已建立');
            // 连接成功后会自动收到公开房间列表
            // 设置定时刷新公开房间列表
            publicRoomsInterval = setInterval(fetchPublicRooms, 5000);
        };
        
        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        websocket.onclose = () => {
            console.log('WebSocket连接已关闭');
            clearInterval(publicRoomsInterval);
            // 可以在这里添加重连逻辑
        };
        
        websocket.onerror = (error) => {
            console.error('WebSocket错误:', error);
        };
    }

    // 处理WebSocket消息
    function handleWebSocketMessage(data) {
        switch (data.type) {
            case 'public_rooms':
            case 'public_rooms_update':
                updatePublicRoomsList(data.rooms);
                break;
            case 'room_created':
                enterGameRoom(data.room_id);
                break;
            case 'join_success':
                enterGameRoom(data.room_id);
                break;
            case 'error':
                alert(data.message);
                break;
            // 其他消息类型处理...
        }
    }

    // 更新公开房间列表
    function updatePublicRoomsList(rooms) {
        publicRoomsList.innerHTML = '';
        
        if (rooms.length === 0) {
            publicRoomsList.innerHTML = '<div class="no-rooms">当前没有公开房间</div>';
            return;
        }
        
        rooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            roomItem.innerHTML = `
                <div class="room-item-info">
                    房间 ${room.id} <span>${room.players}/${room.max_players} 玩家</span>
                </div>
                <button class="join-public-room-btn" data-room-id="${room.id}">加入</button>
            `;
            publicRoomsList.appendChild(roomItem);
            
            // 为加入按钮添加事件监听
            const joinBtn = roomItem.querySelector('.join-public-room-btn');
            joinBtn.addEventListener('click', () => {
                joinRoom(room.id);
            });
        });
    }

    // 获取公开房间列表
    function fetchPublicRooms() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'get_public_rooms'
            }));
        } else {
            // 如果WebSocket未连接，则通过API获取
            fetch('/api/public_rooms')
                .then(response => response.json())
                .then(rooms => {
                    updatePublicRoomsList(rooms);
                })
                .catch(error => {
                    console.error('获取公开房间列表失败:', error);
                });
        }
    }

    // 创建房间
    function createRoom() {
        // 获取玩家名称
        const playerName = playerNameInput.value.trim() || playerNameInput.placeholder;
        
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'create_room',
                user_id: userId,
                player_name: playerName,
                is_public: isPublicCheckbox.checked
            }));
        } else {
            // 如果WebSocket未连接，则通过API创建
            fetch('/api/create_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_public: isPublicCheckbox.checked
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.room_id) {
                        enterGameRoom(data.room_id);
                    }
                })
                .catch(error => {
                    console.error('创建房间失败:', error);
                });
        }
    }

    // 加入房间
    function joinRoom(roomId) {
        if (!roomId) {
            roomId = roomIdInput.value.trim();
        }
        
        if (!roomId) {
            alert('请输入房间ID');
            return;
        }
        
        // 获取玩家名称
        const playerName = playerNameInput.value.trim() || playerNameInput.placeholder;
        
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'join_room',
                user_id: userId,
                player_name: playerName,
                room_id: roomId
            }));
        } else {
            // 直接进入游戏房间，让游戏房间页面处理加入逻辑
            enterGameRoom(roomId);
        }
    }

    // 进入游戏房间
    function enterGameRoom(roomId) {
        // 存储房间ID、用户ID和玩家名称到sessionStorage，以便在游戏房间页面使用
        sessionStorage.setItem('roomId', roomId);
        sessionStorage.setItem('userId', userId);
        sessionStorage.setItem('playerName', playerNameInput.value.trim() || playerNameInput.placeholder);
        
        // 跳转到游戏房间页面
        window.location.href = 'game-room.html';
    }

    // 事件监听
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', () => joinRoom());

    // 初始化WebSocket连接
    initWebSocket();
}); 