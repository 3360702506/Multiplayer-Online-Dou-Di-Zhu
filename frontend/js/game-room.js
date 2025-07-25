document.addEventListener('DOMContentLoaded', () => {
    // --- 元素获取 ---
    const roomIdDisplay = document.getElementById('room-id-display');
    const startGameBtn = document.getElementById('start-game-btn');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const addBotBtn = document.getElementById('add-bot-btn');
    const playCardsBtn = document.getElementById('play-cards-btn');
    const passBtn = document.getElementById('pass-btn');
    const playerYouDiv = document.getElementById('player-you');
    const playerYouName = playerYouDiv.querySelector('.player-name');
    const myHandContainer = playerYouDiv.querySelector('.cards-hand');
    const chatContainer = document.getElementById('chat-container');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const cardTrackerContainer = document.getElementById('card-tracker-container');
    const cardTracker = document.getElementById('card-tracker');
    const landlordCardsDisplay = document.getElementById('landlord-cards-display');
    const playedCardsDisplay = document.getElementById('played-cards-display');
    const playerLeft = document.getElementById('player-left');
    const playerLeftName = playerLeft.querySelector('.player-name');
    const playerRight = document.getElementById('player-right');
    const playerRightName = playerRight.querySelector('.player-name');

    // --- 状态变量 ---
    let websocket = null;
    let roomId = sessionStorage.getItem('roomId');
    let userId = sessionStorage.getItem('userId');
    let playerName = sessionStorage.getItem('playerName') || '玩家';
    let selectedCards = [];
    let myCards = [];
    let isMyTurn = false;
    let lastPlayedCards = null;
    let lastPlayerId = null;
    let gameState = null;

    // 初始化页面
    function initializePage() {
        if (!roomId || !userId) {
            alert('会话信息缺失，请返回大厅重新加入游戏');
            window.location.href = 'index.html';
            return;
        }

        roomIdDisplay.textContent = roomId;
        playerYouName.textContent = playerName;
        
        // 使聊天窗口可拖动
        makeDraggable(chatContainer);
        
        // 初始化WebSocket连接
        initWebSocket();
    }

    // 初始化WebSocket连接
    function initWebSocket() {
        try {
            // 修改WebSocket地址，添加房间ID和用户ID作为路径参数
            websocket = new WebSocket(`ws://localhost:8000/ws/${roomId}/${userId}`);
            
            websocket.onopen = () => {
                console.log('WebSocket连接已建立');
                // 连接后发送玩家信息
                sendPlayerInfo();
            };
            
            websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };
            
            websocket.onclose = () => {
                console.log('WebSocket连接已关闭');
                // 3秒后尝试重连
                setTimeout(() => {
                    console.log('尝试重新连接...');
                    initWebSocket();
                }, 3000);
            };
            
            websocket.onerror = (error) => {
                console.error('WebSocket错误:', error);
            };
        } catch (error) {
            console.error('初始化WebSocket失败:', error);
            // 3秒后尝试重连
            setTimeout(() => {
                console.log('尝试重新连接...');
                initWebSocket();
            }, 3000);
        }
    }
    
    // 发送玩家信息
    function sendPlayerInfo() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                action: 'player_info',
                user_id: userId,
                player_name: playerName,
                room_id: roomId
            }));
        }
    }

    // 处理游戏开始
    function handleGameStarted() {
        console.log('游戏已开始');
        // 禁用开始游戏按钮
        startGameBtn.disabled = true;
        // 禁用添加机器人按钮
        addBotBtn.disabled = true;
        // 显示提示
        alert('游戏开始！等待发牌...');
    }

    // 更新玩家名称
    function updatePlayerNames(players, playerNames) {
        if (!players || !playerNames) return;
        
        console.log('更新玩家名称:', players, playerNames);
        
        // 找到自己和其他玩家
        const otherPlayers = players.filter(id => id !== userId);
        
        // 更新其他玩家名称
        if (otherPlayers.length > 0) {
            const player1Id = otherPlayers[0];
            const name = playerNames[player1Id] || '玩家1';
            playerLeftName.textContent = name;
            // 如果是机器人，添加机器人标识
            if (player1Id.startsWith('bot_')) {
                playerLeftName.innerHTML = `<span class="bot-tag">机器人</span> ${name}`;
            }
        }
        
        if (otherPlayers.length > 1) {
            const player2Id = otherPlayers[1];
            const name = playerNames[player2Id] || '玩家2';
            playerRightName.textContent = name;
            // 如果是机器人，添加机器人标识
            if (player2Id.startsWith('bot_')) {
                playerRightName.innerHTML = `<span class="bot-tag">机器人</span> ${name}`;
            }
        }
    }

    // 重新加入房间
    function rejoinRoom() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                action: 'rejoin_room',
                user_id: userId,
                player_name: playerName,
                room_id: roomId
            }));
        }
    }

    // 更新游戏状态
    function updateGameState(state) {
        gameState = state;
        
        // 更新玩家列表
        updatePlayerList(state.players);
        
        // 更新地主牌显示
        updateLandlordCards(state.landlord_cards);
        
        // 更新记牌器
        updateCardTracker(state.card_tracker);
        
        // 更新开始游戏按钮状态
        if (state.game_state !== 'waiting') {
            startGameBtn.disabled = true;
        } else {
            startGameBtn.disabled = false;
        }
        
        // 其他状态更新...
    }

    // 更新玩家列表
    function updatePlayerList(players) {
        // 找到自己和其他玩家
        const me = players.find(p => p.id === userId);
        const others = players.filter(p => p.id !== userId);
        
        // 更新自己的信息
        if (me) {
            if (me.is_landlord) {
                playerYouDiv.classList.add('is-landlord');
            } else {
                playerYouDiv.classList.remove('is-landlord');
            }
        }
        
        // 更新其他玩家信息
        if (others.length > 0) {
            const player1 = others[0];
            const player1Cards = playerLeft.querySelector('.cards-opponent');
            player1Cards.textContent = player1.card_count || 0;
            
            if (player1.is_landlord) {
                playerLeft.classList.add('is-landlord');
            } else {
                playerLeft.classList.remove('is-landlord');
            }
        }
        
        if (others.length > 1) {
            const player2 = others[1];
            const player2Cards = playerRight.querySelector('.cards-opponent');
            player2Cards.textContent = player2.card_count || 0;
            
            if (player2.is_landlord) {
                playerRight.classList.add('is-landlord');
            } else {
                playerRight.classList.remove('is-landlord');
            }
        }
    }

    // 开始游戏
    function startGame() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                action: 'start_game',
                user_id: userId,
                room_id: roomId
            }));
        }
    }

    // 处理发牌
    function handleDealtCards(cards) {
        myCards = cards;
        displayHand();
    }

    // 显示手牌
    function displayHand() {
        myHandContainer.innerHTML = '';
        
        myCards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.textContent = getCardDisplay(card);
            
            // 根据卡牌类型设置颜色
            let isRed = false;
            
            if (typeof card === 'object' && card !== null) {
                isRed = card.suit === 'hearts' || card.suit === 'diamonds' || 
                        card.suit === '♥' || card.suit === '♦' || 
                        (card.suit === 'Joker' && card.rank === 'Red');
            } else if (typeof card === 'string') {
                isRed = card.includes('hearts') || card.includes('diamonds') || card.includes('red_joker');
            }
            
            if (isRed) {
                cardElement.style.color = 'red';
            }
            
            // 设置大小王样式
            if ((typeof card === 'object' && card.suit === 'Joker') || 
                (typeof card === 'string' && card.includes('joker'))) {
                cardElement.classList.add(
                    (card.rank === 'Red' || card.includes('red')) ? 'red-joker' : 'black-joker'
                );
            }
            
            cardElement.dataset.card = JSON.stringify(card);
            cardElement.dataset.index = index;
            
            // 检查是否已选中
            if (selectedCards.some(c => JSON.stringify(c) === JSON.stringify(card))) {
                cardElement.classList.add('selected');
            }
            
            // 添加点击事件
            cardElement.addEventListener('click', () => {
                toggleCardSelection(cardElement, card);
            });
            
            myHandContainer.appendChild(cardElement);
        });
    }

    // 切换卡牌选择状态
    function toggleCardSelection(cardElement, card) {
        // 使用JSON字符串比较卡牌
        const cardStr = JSON.stringify(card);
        const index = selectedCards.findIndex(c => JSON.stringify(c) === cardStr);
        
        if (index === -1) {
            // 选中卡牌
            selectedCards.push(card);
            cardElement.classList.add('selected');
        } else {
            // 取消选中
            selectedCards.splice(index, 1);
            cardElement.classList.remove('selected');
        }
        
        // 更新出牌按钮状态
        updatePlayButtonState();
    }

    // 更新出牌按钮状态
    function updatePlayButtonState() {
        playCardsBtn.disabled = !isMyTurn || selectedCards.length === 0;
    }

    // 处理轮到自己出牌
    function handleYourTurn(data) {
        isMyTurn = true;
        lastPlayedCards = data.last_played_cards;
        lastPlayerId = data.last_player_id;
        
        // 启用按钮
        playCardsBtn.disabled = selectedCards.length === 0;
        passBtn.disabled = false;
        
        // 如果是第一个出牌的人，禁用"不出"按钮
        if (!lastPlayedCards || lastPlayerId === userId) {
            passBtn.disabled = true;
        }
    }

    // 出牌
    function playCards() {
        if (!isMyTurn || selectedCards.length === 0) return;
        
        websocket.send(JSON.stringify({
            action: 'play_cards',
            user_id: userId,
            room_id: roomId,
            cards: selectedCards
        }));
        
        // 重置状态
        selectedCards = [];
        isMyTurn = false;
        playCardsBtn.disabled = true;
        passBtn.disabled = true;
    }

    // 不出
    function passPlay() {
        if (!isMyTurn || passBtn.disabled) return;
        
        websocket.send(JSON.stringify({
            action: 'pass',
            user_id: userId,
            room_id: roomId
        }));
        
        // 重置状态
        selectedCards = [];
        isMyTurn = false;
        playCardsBtn.disabled = true;
        passBtn.disabled = true;
    }

    // 处理玩家出牌
    function handleCardsPlayed(data) {
        const { player_id, cards } = data;
        
        // 更新已出牌区域
        updatePlayedCardsDisplay(cards);
        
        // 更新玩家手牌数量
        updatePlayerCardCount(player_id, data.remaining_count);
        
        // 如果是自己出的牌，从手牌中移除
        if (player_id === userId) {
            removeCardsFromHand(cards);
        }
        
        // 更新记牌器
        if (data.card_tracker) {
            updateCardTracker(data.card_tracker);
        }
        
        // 显示出牌信息
        showPlayedCardIndicator(player_id, '出牌');
    }

    // 处理玩家不出
    function handlePlayerPassed(data) {
        const { player_id } = data;
        
        // 显示不出信息
        showPlayedCardIndicator(player_id, '不出');
    }

    // 显示出牌/不出信息
    function showPlayedCardIndicator(playerId, action) {
        let playerDiv;
        
        if (playerId === userId) {
            playerDiv = playerYouDiv;
        } else {
            const players = gameState.players;
            const playerIndex = players.findIndex(p => p.id === playerId);
            
            if (playerIndex === 1) {
                playerDiv = playerLeft;
            } else if (playerIndex === 2) {
                playerDiv = playerRight;
            }
        }
        
        if (playerDiv) {
            const indicator = playerDiv.querySelector('.played-card-indicator');
            if (indicator) {
                indicator.textContent = action;
                
                // 3秒后清除
                setTimeout(() => {
                    indicator.textContent = '';
                }, 3000);
            }
        }
    }

    // 从手牌中移除已出的牌
    function removeCardsFromHand(cards) {
        // 将已出的牌转换为JSON字符串进行比较
        const cardStrings = cards.map(card => JSON.stringify(card));
        
        // 过滤掉已出的牌
        myCards = myCards.filter(card => !cardStrings.includes(JSON.stringify(card)));
        
        // 重新显示手牌
        displayHand();
    }

    // 更新玩家手牌数量
    function updatePlayerCardCount(playerId, count) {
        if (playerId === userId) return;
        
        const players = gameState.players;
        const playerIndex = players.findIndex(p => p.id === playerId);
        
        if (playerIndex === 1) {
            const cardCount = playerLeft.querySelector('.cards-opponent');
            cardCount.textContent = count;
        } else if (playerIndex === 2) {
            const cardCount = playerRight.querySelector('.cards-opponent');
            cardCount.textContent = count;
        }
    }

    // 更新已出牌区域
    function updatePlayedCardsDisplay(cards) {
        playedCardsDisplay.innerHTML = '';
        
        if (!cards || cards.length === 0) return;
        
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.textContent = getCardDisplay(card);
            
            // 根据卡牌类型设置颜色
            let isRed = false;
            
            if (typeof card === 'object' && card !== null) {
                isRed = card.suit === 'hearts' || card.suit === 'diamonds' || 
                        card.suit === '♥' || card.suit === '♦' || 
                        (card.suit === 'Joker' && card.rank === 'Red');
            } else if (typeof card === 'string') {
                isRed = card.includes('hearts') || card.includes('diamonds') || card.includes('red_joker');
            }
            
            if (isRed) {
                cardElement.style.color = 'red';
            }
            
            // 设置大小王样式
            if ((typeof card === 'object' && card.suit === 'Joker') || 
                (typeof card === 'string' && card.includes('joker'))) {
                cardElement.classList.add(
                    (card.rank === 'Red' || card.includes('red')) ? 'red-joker' : 'black-joker'
                );
            }
            
            playedCardsDisplay.appendChild(cardElement);
        });
    }

    // 更新地主牌显示
    function updateLandlordCards(cards) {
        landlordCardsDisplay.innerHTML = '';
        
        if (!cards || cards.length === 0) return;
        
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.textContent = getCardDisplay(card);
            
            // 根据卡牌类型设置颜色
            let isRed = false;
            
            if (typeof card === 'object' && card !== null) {
                isRed = card.suit === 'hearts' || card.suit === 'diamonds' || 
                        card.suit === '♥' || card.suit === '♦' || 
                        (card.suit === 'Joker' && card.rank === 'Red');
            } else if (typeof card === 'string') {
                isRed = card.includes('hearts') || card.includes('diamonds') || card.includes('red_joker');
            }
            
            if (isRed) {
                cardElement.style.color = 'red';
            }
            
            // 设置大小王样式
            if ((typeof card === 'object' && card.suit === 'Joker') || 
                (typeof card === 'string' && card.includes('joker'))) {
                cardElement.classList.add(
                    (card.rank === 'Red' || card.includes('red')) ? 'red-joker' : 'black-joker'
                );
            }
            
            landlordCardsDisplay.appendChild(cardElement);
        });
    }

    // 更新记牌器
    function updateCardTracker(tracker) {
        cardTracker.innerHTML = '';
        
        if (!tracker) return;
        
        const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
        const values = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        
        // 添加普通牌
        for (const value of values) {
            for (const suit of suits) {
                const key = `${value}_of_${suit}`;
                const isOut = tracker[key] === 0;
                
                const trackerItem = document.createElement('div');
                trackerItem.className = `tracker-item${isOut ? ' out-of-play' : ''}`;
                trackerItem.textContent = `${value}${getSuitSymbol(suit)}`;
                
                if (suit === 'hearts' || suit === 'diamonds') {
                    trackerItem.style.color = 'red';
                }
                
                cardTracker.appendChild(trackerItem);
            }
        }
        
        // 添加大小王
        const redJokerKey = 'red_joker';
        const blackJokerKey = 'black_joker';
        
        const redJokerItem = document.createElement('div');
        redJokerItem.className = `tracker-item is-king is-red-joker${tracker[redJokerKey] === 0 ? ' out-of-play' : ''}`;
        redJokerItem.textContent = '大王';
        cardTracker.appendChild(redJokerItem);
        
        const blackJokerItem = document.createElement('div');
        blackJokerItem.className = `tracker-item is-king${tracker[blackJokerKey] === 0 ? ' out-of-play' : ''}`;
        blackJokerItem.textContent = '小王';
        cardTracker.appendChild(blackJokerItem);
    }

    // 处理游戏结束
    function handleGameOver(data) {
        const { winner_id, winner_role } = data;
        
        let message = '';
        if (winner_id === userId) {
            message = '恭喜你赢了！';
        } else {
            message = `${winner_role === 'landlord' ? '地主' : '农民'}赢了！`;
        }
        
        alert(message);
        
        // 禁用游戏按钮
        playCardsBtn.disabled = true;
        passBtn.disabled = true;
        
        // 可以添加重新开始按钮等
    }

    // 处理聊天消息
    function handleChatMessage(data) {
        const { sender_id, sender_name, message } = data;
        
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${sender_id === userId ? 'is-you' : 'is-other'}`;
        
        const senderElement = document.createElement('div');
        senderElement.className = 'sender';
        senderElement.textContent = sender_id === userId ? '你' : (sender_name || '玩家');
        
        const contentElement = document.createElement('div');
        contentElement.className = 'content';
        contentElement.textContent = message;
        
        messageElement.appendChild(senderElement);
        messageElement.appendChild(contentElement);
        
        chatMessages.appendChild(messageElement);
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 发送聊天消息
    function sendChatMessage() {
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        websocket.send(JSON.stringify({
            action: 'chat',
            user_id: userId,
            room_id: roomId,
            message
        }));
        
        // 清空输入框
        chatInput.value = '';
    }

    // 离开房间
    function leaveRoom() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                action: 'leave_room',
                user_id: userId,
                room_id: roomId
            }));
        }
        
        // 清除会话存储
        sessionStorage.removeItem('roomId');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('playerName');
        
        // 返回大厅
        window.location.href = 'index.html';
    }

    // 添加机器人
    function addBot() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                action: 'add_bot',
                user_id: userId,
                room_id: roomId
            }));
        }
    }

    // 处理叫地主
    function handleBidding() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            const bidDialog = document.createElement('div');
            bidDialog.className = 'bid-dialog';
            bidDialog.innerHTML = `
                <div class="bid-dialog-content">
                    <h3>是否叫地主？</h3>
                    <div class="bid-buttons">
                        <button id="bid-yes" class="game-btn">叫地主</button>
                        <button id="bid-no" class="game-btn">不叫</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(bidDialog);
            
            document.getElementById('bid-yes').addEventListener('click', () => {
                websocket.send(JSON.stringify({
                    action: 'bid',
                    user_id: userId,
                    room_id: roomId,
                    choice: 'bid'
                }));
                document.body.removeChild(bidDialog);
            });
            
            document.getElementById('bid-no').addEventListener('click', () => {
                websocket.send(JSON.stringify({
                    action: 'bid',
                    user_id: userId,
                    room_id: roomId,
                    choice: 'pass'
                }));
                document.body.removeChild(bidDialog);
            });
        }
    }

    // 获取卡牌显示
    function getCardDisplay(card) {
        // 检查卡牌是否为对象
        if (typeof card === 'object' && card !== null) {
            // 如果是对象格式，直接使用属性
            if (card.rank === 'Red' && card.suit === 'Joker') return '大王';
            if (card.rank === 'Black' && card.suit === 'Joker') return '小王';
            return `${card.rank}${getSuitSymbol(card.suit)}`;
        }
        
        // 如果是字符串格式
        if (typeof card === 'string') {
            if (card === 'red_joker') return '大王';
            if (card === 'black_joker') return '小王';
            
            // 尝试分割字符串
            try {
                const parts = card.split('_of_');
                if (parts.length === 2) {
                    const value = parts[0];
                    const suit = parts[1];
                    return `${value}${getSuitSymbol(suit)}`;
                }
            } catch (error) {
                console.error('解析卡牌字符串失败:', card, error);
            }
        }
        
        // 如果无法解析，返回默认值
        console.warn('无法识别的卡牌格式:', card);
        return '?';
    }

    // 获取花色符号
    function getSuitSymbol(suit) {
        switch (suit) {
            case 'spades': return '♠';
            case 'hearts': return '♥';
            case 'clubs': return '♣';
            case 'diamonds': return '♦';
            case '♠': return '♠';
            case '♥': return '♥';
            case '♣': return '♣';
            case '♦': return '♦';
            default: return '';
        }
    }

    // 使元素可拖动
    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        element.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            
            // 获取鼠标位置
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
            
            // 改变光标样式
            element.style.cursor = 'grabbing';
        }
        
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            
            // 计算新位置
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // 设置元素新位置
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            // 停止移动
            document.onmouseup = null;
            document.onmousemove = null;
            
            // 恢复光标样式
            element.style.cursor = 'grab';
        }
    }

    // 处理WebSocket消息
    function handleWebSocketMessage(data) {
        console.log('收到消息:', data);
        switch (data.type) {
            case 'player_update':
                updatePlayerNames(data.players, data.player_names);
                break;
            case 'game_started':
                handleGameStarted();
                break;
            case 'game_state':
                updateGameState(data.state);
                break;
            case 'deal_cards':
                handleDealtCards(data.cards);
                break;
            case 'your_turn':
                handleYourTurn(data);
                break;
            case 'your_turn_to_bid':
                handleBidding();
                break;
            case 'cards_played':
                handleCardsPlayed(data);
                break;
            case 'player_passed':
                handlePlayerPassed(data);
                break;
            case 'game_over':
                handleGameOver(data);
                break;
            case 'chat_message':
                handleChatMessage(data);
                break;
            case 'error':
                alert(data.message);
                break;
            // 其他消息类型处理...
        }
    }

    // 事件监听
    startGameBtn.addEventListener('click', startGame);
    leaveRoomBtn.addEventListener('click', leaveRoom);
    addBotBtn.addEventListener('click', addBot);
    playCardsBtn.addEventListener('click', playCards);
    passBtn.addEventListener('click', passPlay);
    sendChatBtn.addEventListener('click', sendChatMessage);
    
    // 按Enter键发送消息
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // 初始化页面
    initializePage();
}); 