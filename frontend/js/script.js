document.addEventListener('DOMContentLoaded', () => {
    // --- Globally Safe Element Getters ---
    const lobby = document.getElementById('lobby');
    const gameRoomWrapper = document.getElementById('game-room-wrapper');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomIdInput = document.getElementById('room-id-input');
    const isPublicCheckbox = document.getElementById('is-public-checkbox');
    const publicRoomsList = document.getElementById('public-rooms-list');

    // --- State Variables ---
    let websocket = null;
    let userId = 'user_' + Math.random().toString(36).substr(2, 9);
    let publicRoomsInterval;
    
    // --- Game-Room-Only Variables (will be assigned later) ---
    let playerYouDiv, myHandContainer, chatContainer; 
    let selectedCards = [];

    function initializeGameRoomElements() {
        // This function is called ONLY when we enter the game room
        playerYouDiv = document.getElementById('player-you');
        myHandContainer = playerYouDiv.querySelector('.cards-hand');
        chatContainer = document.getElementById('chat-container');
        // Initialize draggable functionality now that the element exists
        if (chatContainer) {
            makeDraggable(chatContainer);
        }
        // ... get other game-room specific elements here
    }

    function showGameRoom(roomId) {
        lobby.style.display = 'none';
        if (gameRoomWrapper) {
            gameRoomWrapper.style.display = 'flex'; // Use flex for alignment
            initializeGameRoomElements(); // Find elements now
        }
        // ... rest of showGameRoom
    }
    
    // ... all other functions like updatePlayerList, displayHand, makeDraggable etc.
    // They will now safely use the variables assigned in initializeGameRoomElements.
});
