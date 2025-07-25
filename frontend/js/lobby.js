// 全局变量
let websocket;
let userId = 'user_' + generateRandomId();
let playerName = generateRandomName();

// DOM元素
const playerNameInput = document.getElementById('player-name-input');
const roomIdInput = document.getElementById('room-id-input');
const isPublicCheckbox = document.getElementById('is-public-checkbox');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const publicRoomsList = document.getElementById('public-rooms-list');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('大厅页面初始化');
    
    // 设置随机玩家名称
    playerNameInput.value = playerName;
    
    // 初始化WebSocket连接
    initWebSocket();
    
    // 事件监听
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', joinRoom);
    
    // 如果WebSocket连接失败或关闭，使用HTTP API获取公开房间
    setTimeout(() => {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket未连接，使用HTTP API获取公开房间');
            fetchPublicRooms();
        }
    }, 2000);
});

// 初始化WebSocket连接
function initWebSocket() {
    const wsUrl = `ws://localhost:8000/ws/lobby/${userId}`;
    console.log('正在连接WebSocket:', wsUrl);
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
        console.log('WebSocket连接已建立');
        fetchPublicRooms();
    };
    
    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    websocket.onerror = (error) => {
        console.log('WebSocket错误:', error);
        // 使用HTTP API作为备用
        fetchPublicRooms();
    };
    
    websocket.onclose = () => {
        console.log('WebSocket连接已关闭');
    };
}

// 处理WebSocket消息
function handleWebSocketMessage(data) {
    console.log('收到WebSocket消息:', data);
    
    switch (data.type) {
        case 'public_rooms':
            displayPublicRooms(data.rooms);
            break;
        case 'public_rooms_update':
            displayPublicRooms(data.rooms);
            break;
        case 'room_created':
            if (data.success) {
                enterGameRoom(data.room_id);
            } else {
                alert(data.message || '创建房间失败');
            }
            break;
        case 'join_success':
            enterGameRoom(data.room_id);
            break;
        case 'error':
            alert(data.message);
            break;
    }
}

// 获取公开房间列表
function fetchPublicRooms() {
    console.log('获取公开房间列表');
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            action: 'get_public_rooms'
        }));
    } else {
        // 使用HTTP API作为备用
        fetch('/api/public_rooms')
            .then(response => response.json())
            .then(data => {
                displayPublicRooms(data.rooms);
            })
            .catch(error => {
                console.error('获取公开房间失败:', error);
            });
    }
}

// 显示公开房间列表
function displayPublicRooms(rooms) {
    console.log('显示公开房间列表:', rooms);
    
    publicRoomsList.innerHTML = '';
    
    if (!rooms || rooms.length === 0) {
        const noRoomsMsg = document.createElement('div');
        noRoomsMsg.className = 'no-rooms-message';
        noRoomsMsg.textContent = '当前没有公开房间';
        publicRoomsList.appendChild(noRoomsMsg);
        return;
    }
    
    rooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item';
        roomItem.innerHTML = `
            <div class="room-item-info">
                <div class="room-id">房间ID: ${room.id}</div>
                <div class="room-players">玩家: ${room.players}/${room.max_players}</div>
            </div>
            <button class="join-public-room-btn" data-room-id="${room.id}">加入</button>
        `;
        
        publicRoomsList.appendChild(roomItem);
        
        // 添加加入按钮的点击事件
        const joinBtn = roomItem.querySelector('.join-public-room-btn');
        joinBtn.addEventListener('click', () => {
            joinRoom(room.id);
        });
    });
}

// 创建房间
function createRoom() {
    const isPublic = isPublicCheckbox.checked;
    playerName = playerNameInput.value.trim() || generateRandomName();
    
    console.log('创建房间:', { isPublic, playerName });
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            action: 'create_room',
            is_public: isPublic,
            player_name: playerName
        }));
    } else {
        // 使用HTTP API作为备用
        fetch('/api/create_room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_public: isPublic,
                user_id: userId,
                player_name: playerName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                enterGameRoom(data.room_id);
            } else {
                alert(data.message || '创建房间失败');
            }
        })
        .catch(error => {
            console.error('创建房间失败:', error);
            alert('创建房间失败，请重试');
        });
    }
}

// 加入房间
function joinRoom(roomId) {
    const targetRoomId = roomId || roomIdInput.value.trim();
    playerName = playerNameInput.value.trim() || generateRandomName();
    
    if (!targetRoomId) {
        alert('请输入房间ID');
        return;
    }
    
    console.log('加入房间:', { roomId: targetRoomId, playerName });
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            action: 'join_room',
            room_id: targetRoomId,
            player_name: playerName
        }));
    } else {
        // 使用HTTP API作为备用
        fetch(`/api/join_room/${targetRoomId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                player_name: playerName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                enterGameRoom(targetRoomId);
            } else {
                alert(data.message || '加入房间失败');
            }
        })
        .catch(error => {
            console.error('加入房间失败:', error);
            alert('加入房间失败，请重试');
        });
    }
}

// 进入游戏房间
function enterGameRoom(roomId) {
    // 保存会话信息
    sessionStorage.setItem('roomId', roomId);
    sessionStorage.setItem('userId', userId);
    sessionStorage.setItem('playerName', playerName);
    
    // 跳转到游戏房间页面
    window.location.href = 'game-room.html';
}

// 生成随机ID
function generateRandomId() {
    return Math.random().toString(36).substring(2, 10);
}

// 生成随机玩家名称
function generateRandomName() {
    const prefixes = ['快乐', '开心', '幸运', '勇敢', '聪明', '机智', '厉害', '无敌', '超级', '神奇'];
    const suffixes = ['玩家', '斗士', '高手', '大师', '王者', '冠军', '达人', '英雄', '勇士', '天才'];
    
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const randomNum = Math.floor(Math.random() * 100);
    
    return `${randomPrefix}${randomSuffix}${randomNum}`;
} 