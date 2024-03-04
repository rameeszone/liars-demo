var gameClient;
let gameScene;

var url = new URL(window.location.href);

async function runSocket(game) {

    gameScene = game;
   // gameClient = new WebSocket('ws://162.241.127.138:30008');
    gameClient = new WebSocket('ws://18.207.65.3:3001');
    //gameClient.connect();


    gameClient.addEventListener('open', (event) => {
        console.log('WebSocket connection opened:', event);
        // Send a message to the server
        sendInitialJoin_fn();
    });


    gameClient.addEventListener('message', (event) => {
        // console.log('Received message from server:', event.data);

        const responseMsg = JSON.parse(event.data);
        console.log('.............. :', responseMsg);

        switch (responseMsg.action) {

            case "createRoom":
                gameScene.gameInfo.statusTxt.text = "Room not created.";
                break;

            case "seatPositions":
                gameScene.gameInfo.statusTxt.text = "Game will start soon.";
                gameScene.seatPositions(responseMsg);
                break;

            case "SeatFilled":
                gameScene.gameInfo.statusTxt.text = "Room filled.";
                break;

            case "rollDice":
                gameScene.rollDice(responseMsg);
                break;

            case "startGame":
                gameScene.startGame(responseMsg);
                break;

            case "newTurn":
                gameScene.newTurn(responseMsg);
                break;

            case "revealCards":
                gameScene.revealCards(responseMsg);
                break;

            case "winner":
                gameScene.winner(responseMsg);
                break;
        }

    });

    // Listen for WebSocket errors
    gameClient.addEventListener('error', (event) => {
        // console.log("error called ")
        gameScene.clearAll();
        if (gameScene.gameInfo.statusTxt.text != "Room filled." && gameScene.gameInfo.statusTxt.text != "Room not created.") {
            if (gameScene.seatId != null) {
                gameScene.gameInfo.statusTxt.text = "Game over!!!";
            } else {
                gameScene.gameInfo.statusTxt.text = "Could not connect!";
            }

        }
    });

    // Connection closed
    gameClient.addEventListener('close', (event) => {
        // console.log("close called ")
        gameScene.clearAll();
        if (gameScene.gameInfo.statusTxt.text != "Room filled." && gameScene.gameInfo.statusTxt.text != "Room not created.") {
            if (gameScene.seatId != null) {
                gameScene.gameInfo.statusTxt.text = "Game over!!!";
            } else {
                gameScene.gameInfo.statusTxt.text = "Could not connect!";
            }
        }

    });

}


function sendInitialJoin_fn() {
    var msg = JSON.stringify({
        action: "InitialJoin",
        name: url.searchParams.get("name"),
        playerID: url.searchParams.get("playerID"),
        roomName: url.searchParams.get("roomName"),
    });
    gameClient.send(msg.toString());
}


function sendBid(bid) {
    var msg = JSON.stringify({
        action: "Bid",
        bid: bid,
    });
    gameClient.send(msg.toString());
}

function sendCall() {
    var msg = JSON.stringify({
        action: "Call",
    });
    gameClient.send(msg.toString());
}



function closeSocket() {
    if (gameClient) {
        gameClient.disconnect();
    }
}

function handleError(reason) {
    // console.log("Error", reason);
}

function addMessage(msg, no) {
    // console.log(no, "server response {" + msg + "}\n");
}


