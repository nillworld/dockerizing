import * as fs from "fs";
import { exec } from "child_process";
import * as WebSocket from "ws";

const WebSocketS = WebSocket.Server;

export class Server {
  public clients: any = [];
  public wss: any = null;
  public server: any = null;

  public start(port: number) {
    this.wss = new WebSocketS({ port: port });
    console.log("WebSocket Initialized", port);

    //웹소켓 연결 핸들러, 연결이 되면 진행됨!
    this.wss.on("connection", (ws: any) => {
      let sandMessage = {
        state: "START",
        downloadedPercent: "",
      };
      let downloadedFileSize = 0;
      let downloadedPercent = "";
      let fileName = "";
      let fileSize = 0;

      this.clients.push(ws);
      console.log("Connected total:", this.clients.length);

      ws.on("message", (message: string) => {
        const jsonMessage = JSON.parse(message);
        // console.log(jsonMessage);
        if (jsonMessage.state === "GENERATOR_START") {
        } else if (jsonMessage.state === "MAKE_DOCKER_FILE") {
          console.log("docker 만들기");
          fs.writeFile(
            "./project/Dockerfile",
            jsonMessage.dockerForm,
            function (err) {
              if (err === null) {
                console.log("success");
                sandMessage.state = "MADE_DOCKER_FILE";
                ws.send(JSON.stringify(sandMessage));
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
        } else if (jsonMessage.state === "SET_FILE_INFO") {
          fileSize = jsonMessage.fileSize;
          fileName = jsonMessage.fileName;
          fs.readdir("./project", (err, fileList) => {
            console.log(fileList);
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
          sandMessage.state = "SET_FILE_INFO";
          ws.send(JSON.stringify(sandMessage));
        } else if (jsonMessage.state === "UPLOADING_FROM_BACK") {
          downloadedFileSize += jsonMessage.value.length;
          downloadedPercent = `${Math.round(
            (downloadedFileSize / fileSize) * 100
          )}%`;
          fs.appendFileSync(`./project/${fileName}`, jsonMessage.value);
          sandMessage.state = "DOWNLOADING_FROM_BACK";
          sandMessage.downloadedPercent = downloadedPercent;
          ws.send(JSON.stringify(sandMessage));
        } else if (message.toString() === "DONE") {
          console.log("done");
          exec("tar -xvf project.tar", (err, out, stderr) => {
            if (err) {
              console.log("err", err);
              return;
            }
            if (out) {
              console.log("out", out);
            }
            console.log("tar");
            sandMessage.state = "TAR";
            ws.send(JSON.stringify(sandMessage));
          });
        } else if (message.toString() === "TAR") {
          console.log("?////");
          exec(
            "cd project && docker build . -t nill/node-web-app",
            (err, out, stderr) => {
              if (err) {
                console.log("err", err);
                return;
              }
              if (out) {
                console.log("out", out);
              }
              console.log("docker build");
              sandMessage.state = "BUILD";
              ws.send(JSON.stringify(sandMessage));
            }
          );
        } else if (message.toString() === "BUILD") {
          exec(
            "docker save -o project.tar nill/node-web-app",
            (err, out, stderr) => {
              if (err) {
                console.log("err", err);
                return;
              }
              if (out) {
                console.log("out", out);
              }
              console.log("doneeeeeeee");
            }
          );
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
