const http = require("http");
const WebSocketServer = require("websocket").server;
const WebSocket = require('ws');

const expressPort = 3000;
let socketPort = 3001;

const server = http.createServer();
server.listen(socketPort);
const wsServer = new WebSocketServer({
  httpServer: server,
});

var gameRoom = [];
var allBots = [];

const express = require('express');
const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Endpoint to handle room creation
app.get('/createRoom/', (req, res) => {
  const roomId = req.query.roomid;
  // Check if the room ID already exists
  if (gameRoom[roomId]) {
    return res.json({ status: 'FAIL', message: 'Room ID already exists' });
  }

  // Add the room ID to the global variable
  gameRoom[roomId] = [];
  gameRoom[roomId]["gameTimer"];
  gameRoom[roomId]["gamestarted"] = false;
  gameRoom[roomId]["currentTurn"] = 0;
  gameRoom[roomId]["currentBid"] = 1;
  gameRoom[roomId]["gameRound"] = 1;
  gameRoom[roomId]["allDice"] = [];
  gameRoom[roomId]["lastBidder"] = -1;

  return res.json({ status: 'OK', message: 'Room created successfully' });
});

// Start the server

app.listen(expressPort, () => {
  console.log(`Server is running on http://localhost:${expressPort}`);
});



wsServer.on("request", function (request) {
  // console.log("any request ",request);

  const connection = request.accept(null, request.origin);

  connection.on("message", function (message) {
    try {
      if (message.type === "utf8") {
        // console.log("Received Message: " + message.utf8Data);
        var response = JSON.parse(message.utf8Data);

        switch (response.action) {
          case "InitialJoin":
            if (response.name != null && response.playerID != null && response.roomName != null && gameRoom[response.roomName] != null && gameRoom[response.roomName]["gamestarted"] == false) {

              var oldPlayer = false;
              for (var i = 0; i < gameRoom[response.roomName].length; i++) {
                if (gameRoom[response.roomName][i].playerID == response.playerID) {
                  gameRoom[response.roomName][i] = connection;
                  oldPlayer = true;
                }
              }
              var roomName = response.roomName;
              connection.activeConnection = 1;

              connection.name = response.name;
              connection.playerID = response.playerID;
              connection.dice = [];
              connection.diceLength = 2;
              connection.roomName = -1;
              connection.seatId = -1;
              connection.rip = false;

              if (gameRoom[roomName].length < 6) {
                if (oldPlayer == false) {
                  gameRoom[roomName].push(connection);
                }


                connection.roomName = roomName;
                connection.seatId = gameRoom[roomName].length - 1;


                var players = [];
                for (var i = 0; i < gameRoom[roomName].length; i++) {
                  var reply0 = new Object();
                  reply0.seatId = gameRoom[roomName][i].seatId;
                  reply0.name = gameRoom[roomName][i].name;
                  reply0.playerId = gameRoom[roomName][i].playerID;
                  players.push(reply0);
                }


                var reply = new Object();
                reply.action = "seatPositions";
                reply.players = players;
                reply.newJoin = response.name;

                for (var j = 0; j < gameRoom[roomName].length; j++) {
                  reply.seatId = j;
                  gameRoom[roomName][j].sendUTF(JSON.stringify(reply));
                }


                if (gameRoom[roomName].length == 6) {
                  gameRoom[roomName]["gamestarted"] = true;
                  clearInterval(gameRoom[roomName]["gameTimer"]);
                  gameRoom[roomName]["gameTimer"] = setInterval(
                    function () {
                      startDiceRolling_fn(roomName);
                    },
                    3000
                  );
                } else {
                  clearInterval(gameRoom[roomName]["gameTimer"]);
                  gameRoom[roomName]["gameTimer"] = setInterval(
                    function () {
                      requestBot(roomName);
                    },
                    (2500 + Math.random(5000))
                  );
                }

              } else {

                var reply = new Object();
                reply.action = "SeatFilled";
                connection.sendUTF(JSON.stringify(reply));
                connection.close();
              }

            } else {

              if (gameRoom[roomName] == null) {
                var reply = new Object();
                reply.action = "createRoom";
                connection.sendUTF(JSON.stringify(reply));
              }
              connection.close();
            }
            break;

          case "Bid":
            if (connection.seatId == gameRoom[connection.roomName]["currentTurn"]) {
              clearInterval(gameRoom[connection.roomName]["gameTimer"]);

              if (response.bid > gameRoom[connection.roomName]["currentBid"]) {

                gameRoom[connection.roomName]["lastBidder"] = connection.seatId;
                gameRoom[connection.roomName]["currentBid"] = response.bid;

                var reply = new Object();
                reply.action = "newTurn";
                reply.lastPlayerName = gameRoom[connection.roomName][gameRoom[connection.roomName]["currentTurn"]].name;
                reply.lastPlayerId = gameRoom[connection.roomName][gameRoom[connection.roomName]["currentTurn"]].seatId;
                reply.lastBid = response.bid;
                reply.newTurn = findNextTurn(connection.roomName, gameRoom[connection.roomName]["currentTurn"]);
                reply.newPlayerName = gameRoom[connection.roomName][reply.newTurn].name;
                reply.allDiceLength = gameRoom[connection.roomName]["allDice"].length;


                for (var j = 0; j < gameRoom[connection.roomName].length; j++) {
                  reply.dice = gameRoom[connection.roomName][j].dice;
                  reply.seatId = j;
                  gameRoom[connection.roomName][j].sendUTF(JSON.stringify(reply));
                }

                gameRoom[connection.roomName]["currentTurn"] = reply.newTurn;


                gameRoom[connection.roomName]["gameTimer"] = setInterval(function () {
                  noResponse(connection.roomName);
                }, 20000);

              }
            } else {
              console.log("eklse bid")
            }
            break;

          case "Call":
            if (connection.seatId == gameRoom[connection.roomName]["currentTurn"]) {
              clearInterval(gameRoom[connection.roomName]["gameTimer"]);
              checkWinning_fn(connection.roomName);
            }
            break;


        }


        //connection.sendUTF(message.utf8Data);
      } else if (message.type === "binary") {
        var response = JSON.parse(message.binaryData.toString());
      }
    } catch (err) {
      console.log("Try catch error >>>>>>>>>>>>>>>>>>> : ", err);
      connection.close();
    }
  });

  connection.on("close", function (reasonCode, description) {

  });

  connection.on("error", function () {
    // console.log("Client has error :");
  });
});
console.log("server  started : @" + socketPort);



function startDiceRolling_fn(roomName) {
  clearInterval(gameRoom[roomName]["gameTimer"]);


  gameRoom[roomName]["allDice"] = [];
  gameRoom[roomName]["currentBid"] = 1;

  var players = [];
  for (var i = 0; i < gameRoom[roomName].length; i++) {

    gameRoom[roomName][i].dice = [];


    var reply0 = new Object();
    reply0.seatId = gameRoom[roomName][i].seatId;
    reply0.name = gameRoom[roomName][i].name;
    reply0.playerId = gameRoom[roomName][i].playerID;
    reply0.diceLength = gameRoom[roomName][i].diceLength;
    reply0.rip = gameRoom[roomName][i].rip;
    players.push(reply0);
  }


  var reply = new Object();
  reply.action = "rollDice"
  reply.turn = gameRoom[roomName]["currentTurn"];
  reply.activePlayerName = gameRoom[roomName][gameRoom[roomName]["currentTurn"]].name;
  reply.round = gameRoom[roomName]["gameRound"];
  reply.bidPos = gameRoom[roomName]["currentBid"];
  reply.players = players;


  for (var i = 0; i < gameRoom[roomName].length; i++) {
    for (var n = 0; n < gameRoom[roomName][i].diceLength; n++) {
      gameRoom[roomName][i].dice[n] = 1 + Math.floor(Math.random() * 6);
      gameRoom[roomName]["allDice"].push(gameRoom[roomName][i].dice[n]);
    }

    reply.dice = gameRoom[roomName][i].dice;
    gameRoom[roomName][i].sendUTF(JSON.stringify(reply));
  }

  gameRoom[roomName]["gameTimer"] = setInterval(function () {
    startGame_fn(roomName);
  }, 5000);

}




function startGame_fn(roomName) {
  clearInterval(gameRoom[roomName]["gameTimer"]);

  var players = [];
  for (var i = 0; i < gameRoom[roomName].length; i++) {
    var reply0 = new Object();
    reply0.seatId = gameRoom[roomName][i].seatId;
    reply0.name = gameRoom[roomName][i].name;
    reply0.playerId = gameRoom[roomName][i].playerID;
    reply0.diceLength = gameRoom[roomName][i].diceLength;
    reply0.rip = gameRoom[roomName][i].rip;
    players.push(reply0);
  }

  var reply = new Object();
  reply.action = "startGame"
  reply.turn = gameRoom[roomName]["currentTurn"];
  reply.activePlayerName = gameRoom[roomName][gameRoom[roomName]["currentTurn"]].name;
  reply.round = gameRoom[roomName]["gameRound"];
  reply.bidPos = gameRoom[roomName]["currentBid"];
  reply.allDiceLength = gameRoom[roomName]["allDice"].length;
  reply.players = players;

  for (var i = 0; i < gameRoom[roomName].length; i++) {
    reply.dice = gameRoom[roomName][i].dice;
    gameRoom[roomName][i].sendUTF(JSON.stringify(reply));
  }

  gameRoom[roomName]["gameTimer"] = setInterval(function () {
    noResponse(roomName);
  }, 20000);

}



function noResponse(roomName) {
  clearInterval(gameRoom[roomName]["gameTimer"]);

  if (gameRoom[roomName]["currentBid"] == 126 || Math.floor(gameRoom[roomName]["currentBid"] / 10) == (gameRoom[roomName]["allDice"].length)) {
    checkWinning_fn(roomName);
  } else {

    gameRoom[roomName]["lastBidder"] = gameRoom[roomName]["currentTurn"];
    gameRoom[roomName]["currentBid"] = nextAutoPlay(roomName, gameRoom[roomName]["currentBid"]);


    var reply = new Object();
    reply.action = "newTurn";
    reply.lastPlayerName = gameRoom[roomName][gameRoom[roomName]["currentTurn"]].name;
    reply.lastPlayerId = gameRoom[roomName][gameRoom[roomName]["currentTurn"]].seatId;
    reply.lastBid = gameRoom[roomName]["currentBid"];
    reply.newTurn = findNextTurn(roomName, gameRoom[roomName]["currentTurn"]);
    reply.allDiceLength = gameRoom[roomName]["allDice"].length;
    reply.newPlayerName = gameRoom[roomName][reply.newTurn].name;

    for (var j = 0; j < gameRoom[roomName].length; j++) {
      reply.dice = gameRoom[roomName][j].dice;
      reply.seatId = j;
      gameRoom[roomName][j].sendUTF(JSON.stringify(reply));
    }

    gameRoom[roomName]["currentTurn"] = reply.newTurn;
    gameRoom[roomName]["gameTimer"] = setInterval(function () {
      noResponse(roomName);
    }, 20000);
  }
}

function nextAutoPlay(roomName, bidNo) {
  var no = Math.floor(gameRoom[roomName]["currentBid"] / 10);
  var dice = gameRoom[roomName]["currentBid"] % 10;
  if (dice == 1) {
    dice = 2;
  }
  var newBid = ((no + 1) * 10) + dice;

  return newBid;
}



function checkWinning_fn(roomName) {
  var no = Math.floor(gameRoom[roomName]["currentBid"] / 10);
  var dice = gameRoom[roomName]["currentBid"] % 10;
  var liar = true;
  var dicecount = 0;
  var message = "";
  var current = gameRoom[roomName]["currentTurn"];

  for (var i = 0; i < gameRoom[roomName]["allDice"].length; i++) {
    if (gameRoom[roomName]["allDice"][i] == 1 || gameRoom[roomName]["allDice"][i] == dice) {
      dicecount += 1;
    }
  }

  if (dicecount >= no) {
    liar = false;
    gameRoom[roomName][gameRoom[roomName]["currentTurn"]].rip = true;
    gameRoom[roomName][gameRoom[roomName]["currentTurn"]].diceLength = 0;
    gameRoom[roomName]["currentTurn"] = gameRoom[roomName]["lastBidder"];
    message = "Liar "

  } else {

    gameRoom[roomName][gameRoom[roomName]["lastBidder"]].rip = true;
    gameRoom[roomName][gameRoom[roomName]["lastBidder"]].diceLength = 0;
    message = "honest "
  }

  var players = [];
  for (var i = 0; i < gameRoom[roomName].length; i++) {
    var reply0 = new Object();
    reply0.seatId = gameRoom[roomName][i].seatId;
    reply0.name = gameRoom[roomName][i].name;
    reply0.playerId = gameRoom[roomName][i].playerID;
    reply0.diceLength = gameRoom[roomName][i].diceLength;
    reply0.dice = gameRoom[roomName][i].dice;
    reply0.rip = gameRoom[roomName][i].rip;
    players.push(reply0);
  }


  var reply = new Object();
  reply.action = "revealCards"
  reply.dice = dice;
  reply.liar = liar;
  reply.message = message;
  reply.turn = current;
  reply.lastPlayer = gameRoom[roomName][gameRoom[roomName]["lastBidder"]].name;
  reply.activePlayerName = gameRoom[roomName][current].name;
  reply.round = gameRoom[roomName]["gameRound"];
  reply.bidPos = gameRoom[roomName]["currentBid"];
  reply.players = players;
  reply.bidNo = no;
  reply.calledDice = dice;
  reply.diceCount = dicecount;


  for (var i = 0; i < gameRoom[roomName].length; i++) {
    reply.dice = gameRoom[roomName][i].dice;
    gameRoom[roomName][i].sendUTF(JSON.stringify(reply));
  }

  gameRoom[roomName]["gameTimer"] = setInterval(function () {
    checkStatus(roomName);
  }, 11000);

}



function checkStatus(roomName) {
  clearInterval(gameRoom[roomName]["gameTimer"]);
  var allActiveCount = 0;
  var winnerId = -1;
  for (var i = 0; i < gameRoom[roomName].length; i++) {
    if (gameRoom[roomName][i].rip == false) {
      allActiveCount++;
      winnerId = gameRoom[roomName][i].seatId;
    }
  }

  if (allActiveCount == 1) {
    var reply = new Object();
    reply.action = "winner"
    reply.winnerId = winnerId;
    reply.winnerName = gameRoom[roomName][winnerId].name;

    for (var i = 0; i < gameRoom[roomName].length; i++) {
      gameRoom[roomName][i].sendUTF(JSON.stringify(reply));
    }

    gameRoom[roomName]["gameTimer"] = setInterval(function () {
      clearAll(roomName);
    }, 7000);

  } else {
    gameRoom[roomName]["gameRound"]++;
    gameRoom[roomName]["currentBid"] = 0
    startDiceRolling_fn(roomName);
  }
}

function clearAll(roomName) {

  clearInterval(gameRoom[roomName]["gameTimer"]);
  for (var i = 0; i < gameRoom[roomName].length; i++) {
    gameRoom[roomName][i].close()
  }
  gameRoom[roomName] = null;


}



function findNextTurn(roomName, id) {
  var nextId = id;
  var tempPlayers = gameRoom[roomName].slice(0, 6);
  for (var i = 0; i < id + 1; i++) {
    tempPlayers.push(tempPlayers[0]);
    tempPlayers.splice(0, 1);
  }

  for (var k = 0; k < 6; k++) {
    if (tempPlayers[k] != null && tempPlayers[k].rip == false) {
      nextId = tempPlayers[k].seatId;
      break;
    }
  }
  console.log("nextId : ", nextId)
  return nextId;
}




function requestBot(roomName) {
  //const ws = new WebSocket("ws://" + "localhost" + ":" + 30008);
const ws = new WebSocket("ws://18.207.65.3:3001");

  ws.roomName = roomName;
  ws.seatId = -1;
  ws.timer;
  ws.dice = [];

  // WebSocket connection opened handling
  ws.on('open', () => {
    allBots.push(ws);
    var msg = JSON.stringify({
      action: "InitialJoin",
      isBot: true,
      name: "ramesh " + Math.floor(Math.random() * 100),
      playerID: Date.now(),
      roomName: roomName,
    });
    ws.send(msg.toString());
  });

  // WebSocket message handling
  ws.on('message', (message) => {
    // console.log(`Received from server: ${message}`);

    const responseMsg = JSON.parse(message);
    //console.log("server resposne : ", responseMsg)
    switch (responseMsg.action) {

      case "createRoom":
        ws.close();
        break;

      case "seatPositions":
        ws.seatId = responseMsg.seatId;
        break;

      case "SeatFilled":
        ws.close();
        break;

      case "startGame":
        ws.dice = responseMsg.dice;
        //console.log(ws.dice);
        if (ws.seatId == responseMsg.turn) {
          ws.timer = setInterval(function () {
            decideCallorBid(ws, responseMsg.allDiceLength, responseMsg.bidPos);
          }, 7000 + Math.random() * 6000);

        }
        break;

      case "newTurn":
        if (ws.seatId == responseMsg.newTurn) {
          ws.timer = setInterval(function () {
            decideCallorBid(ws, responseMsg.allDiceLength, responseMsg.lastBid);
          }, 7000 + Math.random() * 6000);

        }
        break;

      case "revealCards":
        break;

      case "winner":
        ws.close();
        break;
    }

  });

  // WebSocket connection closed handling
  ws.on('close', () => {
    console.log('Bot disconnected from WebSocket server');

    if (allBots.indexOf(ws) != -1) {
      allBots.splice(allBots.indexOf(ws), 1);
    }
  });



  function decideCallorBid(ws, allDiceLength, lastBid) {
    clearInterval(ws.timer);

    var currentDiceCount = 0;
    for(var i=0; i<2; i++)
    {
      if(ws.dice[i] == Math.floor(lastBid / 10) || ws.dice[i] == 1)
      {
        currentDiceCount ++;
      }
    }

    var lastPos = Math.floor(lastBid / 10);
    if (lastPos == 0) {
      lastPos = 1;
    }

    var lastDice = lastBid % 10;
    if (lastDice <= 1) {
      lastDice = 2;
    }
    var percentage = (lastPos / allDiceLength) * 100;
    var newBid = lastPos + Math.floor(Math.random() * 2);
   
    var newDice = ws.dice[Math.floor(Math.random() * 2)];// lastDice + Math.floor(Math.random() * (6 - lastDice));
    if (newDice == 1) {
      newDice = lastDice + Math.floor(Math.random() * (6 - lastDice));
    }

    if(lastPos <= currentDiceCount)
    {
      newBid = lastPos+1;
      percentage = 0;
      newDice = ws.dice[Math.floor(Math.random() * 2)];
      if(newDice == 1)
      {
          newDice = lastDice + Math.floor(Math.random() * (6 - lastDice));
      }
    }
    newBid = (newBid * 10) + newDice;

    if (newBid > lastBid && Math.floor(newBid / 10) < allDiceLength && percentage < (30 + Math.floor(Math.random() * 20))) {
      var msg = JSON.stringify({
        action: "Bid",
        bid: newBid,
      });
      ws.send(msg.toString());

    } 
    else{
      var msg = JSON.stringify({
        action: "Call",
      });
      ws.send(msg.toString());
    }
  }

}