// 全局变量
let websocket;
let roomId = sessionStorage.getItem('roomId');
let userId = sessionStorage.getItem('userId');
let playerName = sessionStorage.getItem('playerName') || '玩家';
let isMyTurn = false;
let myCards = [];
let selectedCards = [];
let turnTimer = null;
let timeLeft = 20;
let gameState = null;

document.addEventListener('DOMContentLoaded', () => {
    // 初始化页面
    initializePage();
});

// 初始化页面
function initializePage() {
    if (!roomId || !userId) {
        alert('会话信息缺失，请返回大厅重新加入游戏');
        window.location.href = 'index.html';
        return;
    }

    // 获取DOM元素
    const roomIdDisplay = document.getElementById('room-id-display');
    const playerYouDiv = document.getElementById('player-you');
    const playerLeftDiv = document.getElementById('player-left');
    const playerRightDiv = document.getElementById('player-right');
    const playCardsBtn = document.getElementById('play-cards-btn');
    const passBtn = document.getElementById('pass-btn');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const addBotBtn = document.getElementById('add-bot-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const chatContainer = document.getElementById('chat-container');
    const cardTrackerContainer = document.getElementById('card-tracker-container');
    const turnIndicator = document.getElementById('turn-indicator');
    const timerElement = document.getElementById('timer');

    // 设置房间ID和玩家名称
    roomIdDisplay.textContent = roomId;
    playerYouDiv.querySelector('.player-name').textContent = playerName;
    
    // 添加事件监听
    if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', leaveRoom);
    if (addBotBtn) addBotBtn.addEventListener('click', addBot);
    if (startGameBtn) startGameBtn.addEventListener('click', startGame);
    if (playCardsBtn) playCardsBtn.addEventListener('click', playCards);
    if (passBtn) passBtn.addEventListener('click', passPlay);
    
    // 初始化聊天功能
    initChatFeature();
    
    // 使聊天窗口可拖动
    if (chatContainer) makeDraggable(chatContainer);
    if (cardTrackerContainer) {
        makeDraggable(cardTrackerContainer);
        initCardTrackerToggle();
    }
    
    // 初始化记牌器
    initCardTracker();
    
    // 初始化WebSocket连接
    initWebSocket();
}

// 初始化聊天功能
function initChatFeature() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendChatMessage();
        });
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
}
    
    // 初始化记牌器伸缩功能
    function initCardTrackerToggle() {
        const toggleBtn = document.getElementById('toggle-card-tracker');
        
        toggleBtn.addEventListener('click', () => {
            cardTrackerContainer.classList.toggle('collapsed');
            
            if (cardTrackerContainer.classList.contains('collapsed')) {
                toggleBtn.textContent = '展开';
            } else {
                toggleBtn.textContent = '收起';
            }
        });
    }

    // 初始化记牌器
    function initCardTracker() {
        const cardTracker = document.getElementById('card-tracker');
        cardTracker.innerHTML = '';
        
        // 初始化扑克牌记录
        const suits = ['♠', '♥', '♣', '♦'];
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        const suitClasses = ['spades', 'hearts', 'clubs', 'diamonds'];
        
        // 添加普通牌
        for (let rank of ranks) {
            for (let i = 0; i < suits.length; i++) {
                const suit = suits[i];
                const suitClass = suitClasses[i];
                
                const item = document.createElement('div');
                item.className = `card-tracker-item ${suitClass}`;
                item.dataset.rank = rank;
                item.dataset.suit = suit;
                
                const cardName = document.createElement('div');
                cardName.className = 'card-name';
                cardName.textContent = `${rank}${suit}`;
                
                const cardCount = document.createElement('div');
                cardCount.className = 'card-count';
                cardCount.textContent = '1';  // 每种牌初始为1张
                
                item.appendChild(cardName);
                item.appendChild(cardCount);
                cardTracker.appendChild(item);
            }
        }
        
        // 添加大小王
        const jokers = [
            { name: '小王', class: 'black-joker' },
            { name: '大王', class: 'red-joker' }
        ];
        
        for (let joker of jokers) {
            const item = document.createElement('div');
            item.className = `card-tracker-item ${joker.class}`;
            
            const cardName = document.createElement('div');
            cardName.className = 'card-name';
            cardName.textContent = joker.name;
            
            const cardCount = document.createElement('div');
            cardCount.className = 'card-count';
            cardCount.textContent = '1';  // 每种王初始为1张
            
            item.appendChild(cardName);
            item.appendChild(cardCount);
            cardTracker.appendChild(item);
        }
    }
    
    // 更新记牌器
    function updateCardTracker(playedCards) {
        if (!playedCards || !playedCards.length) return;
        
        // 遍历出的牌，减少记牌器中的数量
        playedCards.forEach(card => {
            let selector;
            
            if (typeof card === 'object' && card !== null) {
                // 对象格式的卡牌
                if (card.suit === 'Joker') {
                    // 大小王
                    selector = card.rank === 'Red' ? '.card-tracker-item.red-joker' : '.card-tracker-item.black-joker';
                } else {
                    // 普通牌
                    const suitMap = {
                        '♠': 'spades',
                        '♥': 'hearts',
                        '♣': 'clubs',
                        '♦': 'diamonds',
                        'spades': 'spades',
                        'hearts': 'hearts',
                        'clubs': 'clubs',
                        'diamonds': 'diamonds'
                    };
                    
                    const suitClass = suitMap[card.suit] || '';
                    selector = `.card-tracker-item.${suitClass}[data-rank="${card.rank}"][data-suit="${card.suit}"]`;
                }
            } else if (typeof card === 'string') {
                // 字符串格式的卡牌
                if (card.includes('joker')) {
                    selector = card.includes('red') ? '.card-tracker-item.red-joker' : '.card-tracker-item.black-joker';
                } else {
                    // 普通牌，格式可能是 "A_of_hearts" 或其他
                    // 这里需要根据实际的字符串格式进行解析
                    // 简化处理，假设格式是 "rank_of_suit"
                    const parts = card.split('_of_');
                    if (parts.length === 2) {
                        const rank = parts[0].toUpperCase();
                        const suit = parts[1];
                        selector = `.card-tracker-item.${suit}[data-rank="${rank}"]`;
                    }
                }
            }
            
            // 更新记牌器
            if (selector) {
                const item = document.querySelector(selector);
                if (item) {
                    const countElement = item.querySelector('.card-count');
                    if (countElement) {
                        const currentCount = parseInt(countElement.textContent);
                        if (currentCount > 0) {
                            countElement.textContent = (currentCount - 1).toString();
                        }
                    }
                }
            }
        });
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

    // 更新玩家名称和状态
    function updatePlayerNames(players, playerNames) {
        // 清除之前的玩家ID
        playerLeftDiv.dataset.playerId = '';
        playerRightDiv.dataset.playerId = '';
        
        // 重置玩家名称
        playerLeftDiv.querySelector('.player-name').textContent = '玩家1';
        playerRightDiv.querySelector('.player-name').textContent = '玩家2';
        
        // 移除地主标识
        playerLeftDiv.classList.remove('is-landlord');
        playerRightDiv.classList.remove('is-landlord');
        playerYouDiv.classList.remove('is-landlord');
        
        // 过滤出其他玩家（非当前用户）
        const otherPlayers = players.filter(player => player !== userId);
        
        // 设置玩家名称和ID
        if (otherPlayers.length > 0) {
            playerLeftDiv.dataset.playerId = otherPlayers[0];
            const leftName = playerNames && playerNames[otherPlayers[0]] ? playerNames[otherPlayers[0]] : otherPlayers[0];
            playerLeftDiv.querySelector('.player-name').textContent = leftName;
            
            // 如果是机器人，添加标识
            if (otherPlayers[0].startsWith('bot_')) {
                const nameElement = playerLeftDiv.querySelector('.player-name');
                if (!nameElement.querySelector('.bot-tag')) {
                    const botTag = document.createElement('span');
                    botTag.className = 'bot-tag';
                    botTag.textContent = '机器人';
                    nameElement.appendChild(botTag);
                }
            }
        }
        
        if (otherPlayers.length > 1) {
            playerRightDiv.dataset.playerId = otherPlayers[1];
            const rightName = playerNames && playerNames[otherPlayers[1]] ? playerNames[otherPlayers[1]] : otherPlayers[1];
            playerRightDiv.querySelector('.player-name').textContent = rightName;
            
            // 如果是机器人，添加标识
            if (otherPlayers[1].startsWith('bot_')) {
                const nameElement = playerRightDiv.querySelector('.player-name');
                if (!nameElement.querySelector('.bot-tag')) {
                    const botTag = document.createElement('span');
                    botTag.className = 'bot-tag';
                    botTag.textContent = '机器人';
                    nameElement.appendChild(botTag);
                }
            }
        }
        
        // 设置自己的名称
        if (playerNames && playerNames[userId]) {
            playerYouDiv.querySelector('.player-name').textContent = playerNames[userId];
        } else {
            playerYouDiv.querySelector('.player-name').textContent = playerName;
        }
    }
    
    // 更新游戏状态
    function updateGameState(state) {
        if (!state) return;
        
        gameState = state;
        
        // 更新玩家手牌数量
        if (state.player_cards) {
            updatePlayerCardCounts(state.player_cards);
        }
        
        // 更新地主标识
        if (state.landlord) {
            // 移除之前的地主标识
            playerLeftDiv.classList.remove('is-landlord');
            playerRightDiv.classList.remove('is-landlord');
            playerYouDiv.classList.remove('is-landlord');
            
            // 添加新的地主标识
            if (state.landlord === userId) {
                playerYouDiv.classList.add('is-landlord');
            } else if (state.landlord === playerLeftDiv.dataset.playerId) {
                playerLeftDiv.classList.add('is-landlord');
            } else if (state.landlord === playerRightDiv.dataset.playerId) {
                playerRightDiv.classList.add('is-landlord');
            }
        }
        
        // 更新地主牌
        if (state.landlord_cards) {
            updateLandlordCards(state.landlord_cards);
        }
        
        // 更新最后出的牌
        if (state.last_played_cards && state.last_played_by) {
            updatePlayedCardsDisplay(state.last_played_cards, state.last_played_by);
        }
    }
    
    // 更新玩家手牌数量
    function updatePlayerCardCounts(playerCards) {
        // 遍历所有玩家的手牌数量
        Object.keys(playerCards).forEach(playerId => {
            if (playerId !== userId) {
                const cardCount = playerCards[playerId];
                
                // 找到对应的玩家元素
                let playerElement;
                if (playerLeftDiv.dataset.playerId === playerId) {
                    playerElement = playerLeftDiv;
                } else if (playerRightDiv.dataset.playerId === playerId) {
                    playerElement = playerRightDiv;
                }
                
                if (playerElement) {
                    const cardsElement = playerElement.querySelector('.cards-count');
                    if (cardsElement) {
                        cardsElement.textContent = cardCount;
                    }
                }
            }
        });
    }
    
    // 显示出牌指示器
    function showPlayedCardIndicator(playerId, action) {
        let playerElement;
        
        if (playerId === userId) {
            playerElement = playerYouDiv;
        } else if (playerLeftDiv.dataset.playerId === playerId) {
            playerElement = playerLeftDiv;
        } else if (playerRightDiv.dataset.playerId === playerId) {
            playerElement = playerRightDiv;
        }
        
        if (playerElement) {
            const indicator = playerElement.querySelector('.played-card-indicator');
            if (indicator) {
                indicator.textContent = action === 'play' ? '出牌' : '不出';
                indicator.className = `played-card-indicator active ${action === 'play' ? 'play' : 'pass'}`;
                
                // 2秒后移除active类
                setTimeout(() => {
                    indicator.className = 'played-card-indicator';
                }, 2000);
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
            const player1Cards = playerLeftDiv.querySelector('.cards-opponent');
            player1Cards.textContent = player1.card_count || 0;
            
            if (player1.is_landlord) {
                playerLeftDiv.classList.add('is-landlord');
            } else {
                playerLeftDiv.classList.remove('is-landlord');
            }
        }
        
        if (others.length > 1) {
            const player2 = others[1];
            const player2Cards = playerRightDiv.querySelector('.cards-opponent');
            player2Cards.textContent = player2.card_count || 0;
            
            if (player2.is_landlord) {
                playerRightDiv.classList.add('is-landlord');
            } else {
                playerRightDiv.classList.remove('is-landlord');
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
        playerYouDiv.querySelector('.cards-hand').innerHTML = '';
        
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
            
            playerYouDiv.querySelector('.cards-hand').appendChild(cardElement);
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
        const { player, cards } = data;
        
        console.log('处理出牌:', player, cards);
        
        // 更新出牌区域
        updatePlayedCardsDisplay(cards, player);
        
        // 如果是自己出的牌，从手牌中移除
        if (player === userId) {
            removeCardsFromHand(cards);
        }
        
        // 更新玩家手牌数量（如果后端提供了这个信息）
        if (data.player_cards) {
            updatePlayerCardCounts(data.player_cards);
        }
        
        // 更新记牌器
        updateCardTracker(cards);
        
        // 显示出牌指示器
        showPlayedCardIndicator(player, 'play');
        
        // 显示谁出了什么牌
        let playerName = player;
        if (player === userId) {
            playerName = "你";
        } else {
            const playerElement = document.querySelector(`[data-player-id="${player}"] .player-name`);
            if (playerElement) {
                playerName = playerElement.textContent;
            }
        }
        
        showMessage(`${playerName} 出牌：${cards.length}张`);
    }
    
    // 处理玩家不出
    function handlePlayerPassed(data) {
        const { player, action } = data;
        
        // 如果是出牌阶段的不出
        if (action === 'play') {
            // 清空该玩家的出牌区域
            const playedCardsDisplay = document.getElementById('played-cards-display');
            
            // 显示谁不出
            let playerName = player;
            if (player === userId) {
                playerName = "你";
            } else {
                const playerElement = document.querySelector(`[data-player-id="${player}"] .player-name`);
                if (playerElement) {
                    playerName = playerElement.textContent;
                }
            }
            
            showMessage(`${playerName} 不出`);
        }
    }

    // 从手牌中移除出的牌
    function removeCardsFromHand(cardsToRemove) {
        // 深拷贝一份手牌
        const newHand = [...myCards];
        
        // 对于每张要移除的牌
        cardsToRemove.forEach(cardToRemove => {
            // 找到这张牌在手牌中的索引
            let cardIndex = -1;
            
            // 处理不同格式的卡牌
            if (typeof cardToRemove === 'object' && cardToRemove !== null) {
                // 对象格式的卡牌
                for (let i = 0; i < newHand.length; i++) {
                    const handCard = newHand[i];
                    if (typeof handCard === 'object' && 
                        handCard.suit === cardToRemove.suit && 
                        handCard.rank === cardToRemove.rank) {
                        cardIndex = i;
                        break;
                    }
                }
            } else if (typeof cardToRemove === 'string') {
                // 字符串格式的卡牌
                cardIndex = newHand.indexOf(cardToRemove);
            }
            
            // 如果找到了这张牌，从手牌中移除
            if (cardIndex !== -1) {
                newHand.splice(cardIndex, 1);
            }
        });
        
        // 更新手牌
        myCards = newHand;
        
        // 重新显示手牌
        displayHand();
        
        // 清空已选择的牌
        selectedCards = [];
        
        // 更新出牌按钮状态
        if (isMyTurn) {
            playCardsBtn.disabled = selectedCards.length === 0;
        }
    }

    // 更新玩家手牌数量
    function updatePlayerCardCount(playerId, count) {
        if (playerId === userId) return;
        
        const players = gameState.players;
        const playerIndex = players.findIndex(p => p.id === playerId);
        
        if (playerIndex === 1) {
            const cardCount = playerLeftDiv.querySelector('.cards-opponent');
            cardCount.textContent = count;
        } else if (playerIndex === 2) {
            const cardCount = playerRightDiv.querySelector('.cards-opponent');
            cardCount.textContent = count;
        }
    }

    // 更新已出牌区域
    function updatePlayedCardsDisplay(cards, playerId) {
        const playedCardsDisplay = document.getElementById('played-cards-display');
        playedCardsDisplay.innerHTML = '';
        
        if (!cards || cards.length === 0) return;
        
        // 添加玩家标识
        if (playerId) {
            let playerName = playerId;
            if (playerId === userId) {
                playerName = "你";
            } else {
                const playerElement = document.querySelector(`[data-player-id="${playerId}"] .player-name`);
                if (playerElement) {
                    playerName = playerElement.textContent;
                }
            }
            
            const playerLabel = document.createElement('div');
            playerLabel.className = 'played-cards-player';
            playerLabel.textContent = playerName;
            playedCardsDisplay.appendChild(playerLabel);
        }
        
        // 显示出的牌
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card played-card';
            cardElement.innerHTML = getCardDisplay(card);
            playedCardsDisplay.appendChild(cardElement);
        });
    }

    // 更新地主牌显示
    function updateLandlordCards(cards) {
        const landlordCardsDisplay = document.getElementById('landlord-cards-display');
        landlordCardsDisplay.innerHTML = '';
        
        if (!cards || cards.length === 0) return;
        
        // 清除之前可能存在的地主牌
        const existingLandlordCards = document.querySelectorAll('.landlord-card');
        existingLandlordCards.forEach(card => card.remove());
        
        // 显示新的地主牌
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card landlord-card';
            cardElement.innerHTML = getCardDisplay(card);
            landlordCardsDisplay.appendChild(cardElement);
        });
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
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;
        
        const message = chatInput.value.trim();
        if (message && websocket) {
            websocket.send(JSON.stringify({
                action: 'chat',
                user_id: userId,
                room_id: roomId,
                message: message
            }));
            chatInput.value = '';
        }
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
        
        // 获取元素的头部，如果存在
        const header = element.querySelector('.chat-header') || element;
        
        if (header) {
            header.onmousedown = dragMouseDown;
        }
        
        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // 获取鼠标位置
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // 鼠标移动时调用函数
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // 计算新位置
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // 设置元素的新位置
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            // 停止移动
            document.onmouseup = null;
            document.onmousemove = null;
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
            case 'your_turn_to_play':
                handleYourTurnToPlay(data);
                break;
            case 'update_hand':
                handleUpdateHand(data.hand);
                break;
            case 'landlord_decided':
                handleLandlordDecided(data);
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
            case 'player_cards_update':
                updatePlayerCardCounts(data.player_cards);
                break;
            case 'error':
                alert(data.message);
                break;
            // 其他消息类型处理...
        }
    }
    
    // 更新玩家手牌数量
    function updatePlayerCardCounts(playerCards) {
        // 遍历所有玩家的手牌数量
        Object.keys(playerCards).forEach(playerId => {
            if (playerId !== userId) {
                const cardCount = playerCards[playerId];
                
                // 找到对应的玩家元素
                let playerElement;
                if (document.querySelector(`#player-left[data-player-id="${playerId}"]`)) {
                    playerElement = document.querySelector(`#player-left[data-player-id="${playerId}"]`);
                } else if (document.querySelector(`#player-right[data-player-id="${playerId}"]`)) {
                    playerElement = document.querySelector(`#player-right[data-player-id="${playerId}"]`);
                }
                
                if (playerElement) {
                    const cardsElement = playerElement.querySelector('.cards-opponent');
                    if (cardsElement) {
                        cardsElement.textContent = cardCount;
                    }
                }
            }
        });
    }
    
    // 处理手牌更新
    function handleUpdateHand(hand) {
        myCards = hand;
        displayHand();
    }
    
    // 处理地主确定
    function handleLandlordDecided(data) {
        const { landlord, landlord_cards } = data;
        
        // 更新地主牌显示
        updateLandlordCards(landlord_cards);
        
        // 更新玩家状态
        if (landlord === userId) {
            playerYouDiv.classList.add('is-landlord');
        } else if (landlord.startsWith('bot_')) {
            // 找到是哪个机器人成为地主
            const botElements = document.querySelectorAll('.player-opponent');
            botElements.forEach(element => {
                if (element.dataset.playerId === landlord) {
                    element.classList.add('is-landlord');
                }
            });
        }
        
        // 显示提示（不使用弹窗）
        if (landlord === userId) {
            showMessage("你成为了地主！");
        } else {
            const landlordName = document.querySelector(`[data-player-id="${landlord}"] .player-name`).textContent;
            showMessage(`${landlordName} 成为了地主！`);
        }
    }
    
    // 显示消息（不使用弹窗）
    function showMessage(message) {
        // 可以添加一个临时消息显示区域
        const messageElement = document.createElement('div');
        messageElement.className = 'game-message';
        messageElement.textContent = message;
        document.getElementById('center-area').appendChild(messageElement);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageElement.remove();
        }, 3000);
    }
    
    // 处理轮到自己出牌
    function handleYourTurnToPlay(data) {
        isMyTurn = true;
        
        // 启用出牌按钮
        playCardsBtn.disabled = selectedCards.length === 0;
        passBtn.disabled = false;
        
        // 显示出牌提示和计时器
        turnIndicator.classList.remove('hidden');
        startTimer();
    }
    
    // 开始计时器
    function startTimer() {
        // 重置计时器
        if (turnTimer) {
            clearInterval(turnTimer);
        }
        
        timeLeft = 20;
        timerElement.textContent = timeLeft;
        
        turnTimer = setInterval(() => {
            timeLeft--;
            timerElement.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(turnTimer);
                // 时间到，自动不出
                if (isMyTurn) {
                    passPlay();
                }
            }
        }, 1000);
    }
    
    // 停止计时器
    function stopTimer() {
        if (turnTimer) {
            clearInterval(turnTimer);
            turnTimer = null;
        }
        turnIndicator.classList.add('hidden');
    }
    
    // 更新出牌区域
    function updatePlayedCardsDisplay(cards, playerId) {
        const playedCardsDisplay = document.getElementById('played-cards-display');
        playedCardsDisplay.innerHTML = '';
        
        if (!cards || cards.length === 0) return;
        
        // 添加玩家标识
        if (playerId) {
            let playerName = playerId;
            if (playerId === userId) {
                playerName = "你";
            } else {
                const playerElement = document.querySelector(`[data-player-id="${playerId}"] .player-name`);
                if (playerElement) {
                    playerName = playerElement.textContent;
                }
            }
            
            const playerLabel = document.createElement('div');
            playerLabel.className = 'played-cards-player';
            playerLabel.textContent = playerName;
            playedCardsDisplay.appendChild(playerLabel);
        }
        
        // 显示出的牌
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card played-card';
            cardElement.innerHTML = getCardDisplay(card);
            playedCardsDisplay.appendChild(cardElement);
        });
    }
    
    // 出牌
    function playCards() {
        if (!isMyTurn || selectedCards.length === 0) return;
        
        console.log('尝试出牌:', selectedCards);
        
        websocket.send(JSON.stringify({
            action: 'play',
            cards: selectedCards
        }));
        
        // 停止计时器
        stopTimer();
        
        // 重置状态
        isMyTurn = false;
        
        // 禁用按钮
        playCardsBtn.disabled = true;
        passBtn.disabled = true;
    }
    
    // 不出
    function passPlay() {
        if (!isMyTurn) return;
        
        websocket.send(JSON.stringify({
            action: 'pass'
        }));
        
        // 停止计时器
        stopTimer();
        
        // 重置状态
        isMyTurn = false;
        selectedCards = [];
        
        // 禁用按钮
        playCardsBtn.disabled = true;
        passBtn.disabled = true;
    }