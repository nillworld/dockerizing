import * as fs from "fs";
import { exec } from "child_process";

const WebSocketS = require("ws").Server;

export class Server {
  public clients: any = [];
  public wss: any = null;
  public server: any = null;

  public start(port: number) {
    this.wss = new WebSocketS({ port: port });
    console.log("WebSocket Initialized", port);

    //웹소켓 연결 핸들러, 연결이 되면 진행됨!
    this.wss.on("connection", (ws: any) => {
      let handler = "dockerForm";
      let sandMessage = {
        sendChecker: "START",
        downloadedPercent: "",
      };
      let downloadedFileSize = 0;
      let downloadedPercent = "";
      let fileName = "";
      let fileSize = 0;

      this.clients.push(ws);
      console.log("Connected total:", this.clients.length);

      /* ws.on("send_message", async (data: any, cb: any) => {
        if (data.type == "attachment") {
          console.log("Found binary data");
          cb("Received file successfully.");
          return;
        }
        // Process other business...
      }); */

      //메세지 핸들러,클라이언트가 메세지를 보내게되면 여기서 받는다.
      ws.on("message", (message: string) => {
        if (handler === "dockerForm") {
          const options = JSON.parse(message);
          console.log("check!", options);
          fs.writeFile(
            "../project/Dockerfile",
            `FROM ${
              options.from ? `${options.from}` : `node:12`
            }\nLABEL name="test@gmail.com"\n${
              options.workdir ? `WORKDIR ${options.workdir}\n` : ``
            }RUN "${
              options.run ? `${options.from}` : `npm install --silent`
            }"\nADD . /app\nENTRYPOINT ["${
              options.entrypoint ? `${options.entrypoint}` : `node`
            }"]\nCMD ["${options.cmd ? `${options.cmd}` : `index.js`}"]\n${
              options.env ? `ENV ${options.env}\n` : ``
            }${options.arg ? `ARG ${options.arg}` : ``}`,
            function (err) {
              if (err === null) {
                console.log("success");
                // exec("docker", (err, out, stderr) => {
                //   // console.log("docker exec", out);
                //   // console.log("docker exec err", err);
                //   console.log("docker exec stderr", stderr);
                //   ws.send("docker exec", out);
                // });
              } else {
                console.log("fail");
              }
            }
          );
          handler = "fileInfo";
          sandMessage.sendChecker = "FILEINFO";
          ws.send(JSON.stringify(sandMessage));
        } else if (handler === "fileInfo") {
          const JsonMessage = JSON.parse(message);
          fileSize = JsonMessage.fileSize;
          fileName = JsonMessage.fileName;
          console.log("fileName: ", fileName);

          fs.readdir("./", (err, fileList) => {
            const pointIndex = fileName.lastIndexOf(".");
            let fileCounter = 0;

            if (pointIndex !== -1) {
              const fileExtension = fileName.slice(pointIndex);
              const onlyFileName = fileName.replace(fileExtension, "");

              const checkFileName = (name: string) => name === fileName;
              while (fileList.find(checkFileName)) {
                fileCounter += 1;
                fileName =
                  onlyFileName +
                  "(" +
                  fileCounter.toString() +
                  ")" +
                  fileExtension;
              }
            }
          });
          sandMessage.sendChecker = "DATA";
          ws.send(JSON.stringify(sandMessage));
          handler = "data";
        } else if (handler === "data" && message.toString() !== "DONE") {
          downloadedFileSize += message.length;
          downloadedPercent = `${Math.round(
            (downloadedFileSize / fileSize) * 100
          )}%`;
          fs.appendFileSync(`./${fileName}`, message);
          sandMessage.downloadedPercent = downloadedPercent;
          sandMessage.sendChecker = "DOWNLOADING";
          ws.send(JSON.stringify(sandMessage));
          // handler = "check";
        } else if (message.toString() === "DONE") {
        }
      });
    });
    this.wss.on("close", function (error: any) {
      console.log("websever close", error);
    });
    this.wss.on("error", function (error: any) {
      console.log(error);
    });
  }
}
