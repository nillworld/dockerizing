const WebSocketS = require("ws").Server;
const fs = require("fs");
class Sever {
  clients = [];
  wss = null;
  server = null;

  start(port) {
    this.wss = new WebSocketS({ port: port });
    console.log("WebSocket Initialized", port);

    this.wss.on("connection", (ws) => {
      this.clients.push(ws);
      console.log("Connected total:", this.clients.length);

      let fileName = "test.txt";
      let fileSize = 0;
      let handler = "start";
      let downloadedFileSize = 0;
      let downloadedPercent = "";
      let counter = 0;

      let sandMessage = {
        sendChecker: "START",
        downloadedPercent: "",
      };

      ws.on("message", (message) => {
        // counter += 1;
        // console.log(counter);
        // console.log(message.toString());
        if (message.toString() === "START") {
          sandMessage.sendChecker = "FILENAME";
          ws.send(JSON.stringify(sandMessage));
          handler = "fileName";
        } else if (handler === "fileName") {
          let JsonMessage = JSON.parse(message);
          fileName = JsonMessage.fileName;
          fileSize = JsonMessage.fileSize;
          console.log("??", fileName);
          fs.readdir("./", (err, fileList) => {
            const pointIndex = fileName.lastIndexOf(".");
            let fileCounter = 0;

            if (pointIndex !== -1) {
              const fileExtension = fileName.slice(pointIndex);
              const onlyFileName = fileName.replace(fileExtension, "");

              const checkFileName = (name) => name === fileName;
              while (fileList.find(checkFileName)) {
                fileCounter += 1;
                fileName = onlyFileName + "(" + fileCounter.toString() + ")" + fileExtension;
              }
            }
          });
          sandMessage.sendChecker = "DATA";
          ws.send(JSON.stringify(sandMessage));
          handler = "data";
          console.log("fileName", fileName);
        } else if (handler === "data" && message.toString() !== "DONE") {
          downloadedFileSize += message.length;
          downloadedPercent = `${parseInt((downloadedFileSize / fileSize) * 100)}%`;

          fs.appendFileSync(`./${fileName}`, message);
          sandMessage.downloadedPercent = downloadedPercent;
          sandMessage.sendChecker = "DOWNLOADING";
          ws.send(JSON.stringify(sandMessage));
          // handler = "check";
        } else if (message.toString() === "DONE") {
        }
      });
    });

    this.wss.on("close", function (error) {
      console.log("websever close", error);
    });
    this.wss.on("error", function (error) {
      console.log(error);
    });
  }
}

const server = new Sever();
server.start(1234);
