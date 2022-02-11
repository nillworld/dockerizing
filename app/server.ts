import * as fs from "fs";
import * as tar from "tar";
import { exec, spawn, spawnSync } from "child_process";
import * as WebSocket from "ws";
const WebSocketS = WebSocket.Server;

export class Server {
  public clients: any = [];
  public wss: any = null;
  public server: any = null;

  public start(port: number) {
    type Message = {
      state: string;
      value?: string;
    };
    this.wss = new WebSocketS({ port: port });
    console.log("WebSocket Initialized", port);

    this.wss.on("connection", (ws: any) => {
      let sandMessage: Message = {
        state: "START",
        value: "",
      };
      let downloadedFileSize = 0;
      let downloadedPercent = "";
      let tarFile: fs.StatsBase<number>;
      let fileName = "";
      let fileSize = 0;

      this.clients.push(ws);
      console.log("Connected total:", this.clients.length);

      ws.on("message", (message: string) => {
        const senderToBack = (state: string, value?: any) => {
          sandMessage.state = state;
          if (value) {
            sandMessage.value = value;
          }
          ws.send(JSON.stringify(sandMessage));
        };

        const jsonMessage = JSON.parse(message);
        // console.log(jsonMessage);
        if (jsonMessage.state === "GENERATOR_START") {
        } else if (jsonMessage.state === "MAKE_DOCKER_FILE") {
          exec("mkdir project", (err, out, stderr) => {
            console.log(err);
            console.log("docker 만들기");
            fs.writeFile(
              "./project/Dockerfile",
              jsonMessage.dockerForm,
              function (err) {
                if (err === null) {
                  console.log("success");
                  senderToBack("MADE_DOCKER_FILE");
                } else {
                  console.log("fail");
                }
              }
            );
          });
        } else if (jsonMessage.state === "SET_FILE_NAME") {
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
          senderToBack("SET_FILE_NAME");
        } else if (jsonMessage.state === "UPLOADING_FROM_BACK") {
          console.log("@#@$", jsonMessage.fileSize, jsonMessage.value.length);
          if (fileSize === 0) {
            fileSize = jsonMessage.fileSize;
          }
          downloadedFileSize += jsonMessage.value.length;
          downloadedPercent = `${Math.round(
            (downloadedFileSize / fileSize) * 100
          )}%`;
          fs.appendFileSync(
            `./project/${fileName}`,
            Buffer.from(jsonMessage.value, "base64")
          );
          senderToBack("DOWNLOADING_FROM_BACK", downloadedPercent);

          if (downloadedFileSize === fileSize) {
            senderToBack("GENERATOR_DOWNLOAD_DONE");
          }
        } else if (jsonMessage.state === "GENERATOR_TAR_DECOMPRESS") {
          tar
            .x({
              file: "./project/project.tar",
            })
            .then(() => {
              console.log("done");
              try {
                fs.unlinkSync("./project/project.tar");
              } catch (error) {
                console.log("Error:", error);
              }
              senderToBack("GENERATOR_TAR_DECOMPRESS_DONE");
            });
        } else if (jsonMessage.state === "GENERATOR_DOCKER_BUILD") {
          console.log("yeh");
          // <Docker Multi-Archtecture Image set>
          // 먼저 멀티 빌더 셋팅
          // docker buildx create --name [builder instance 명] --driver [드라이버 이름] --use
          // > docker buildx create --name multi-arch-builder --driver docker-container --use multi-arch-builder
          // 멀티 환경으로 도커 빌드
          // > docker buildx build --platform linux/amd64,linux/arm/v7 -f ./project/Dockerfile -t test:0.1 --push .
          const dockerBuild = spawn("docker", [
            "build",
            "-f",
            "./project/Dockerfile",
            "-t",
            "tobesoft:iot-project",
            ".",
          ]);
          // dockerBuild.stdout.on("data", (message) => {
          // console.log("stdout", message.toString());
          // });
          dockerBuild.stderr.on("data", (message) => {
            const dockerBuildDoneMessage =
              "Use 'docker scan' to run Snyk tests against images to find vulnerabilities and learn how to fix them";
            console.log(message.toString().indexOf(dockerBuildDoneMessage));
            console.log("message", message.toString());
            if (message.toString().indexOf(dockerBuildDoneMessage) >= 0) {
              try {
                fs.rmdirSync("./project", { recursive: true });
                console.log(`project dir is deleted!`);
                senderToBack("GENERATOR_DOCKER_BUILD_DONE");
              } catch (err) {
                console.error(`Error while deleting project dir.`);
              }
            }
          });
        } else if (jsonMessage.state === "GENERATOR_DOCKER_SAVE") {
          spawnSync("docker", ["save", "-o", "project.tar", "tobesoft"]);
          spawn("docker", ["rmi", "tobesoft:iot-project"]);
          console.log(
            "도커 이미지 tar로 save 완료 및 docker 이미지 삭제 완료. "
          );
          senderToBack("GENERATOR_DOCKER_SAVE_DONE");

          // load 커맨드> docker load -i project.tar
        } else if (jsonMessage.state === "SEND_TAR_FROM_GENERATOR") {
          console.log("여기2");
          const BUFFER_SIZE_MEGA = 1048576;
          let pos = 0;
          // fs.readFile("project.tar", (err, data) => {
          //   const dataBase64 = data.toString("base64");
          //   fileSize = dataBase64.length;
          //   senderToBack("GENERATOR_DOCKER_SIZE", fileSize);
          //   sandMessage.state = "SENDING_TAR_FROM_GENERATOR";
          //   while (pos != fileSize) {
          //     sandMessage.value = dataBase64.slice(pos, pos + BUFFER_SIZE_MEGA);
          //     ws.send(JSON.stringify(sandMessage));

          //     pos = pos + BUFFER_SIZE_MEGA;
          //     if (pos > fileSize) {
          //       pos = fileSize;
          //     }
          //   }
          //   try {
          //     fs.unlinkSync("./project.tar");
          //   } catch (error) {
          //     console.log("Error:", error);
          //   }
          // });

          senderToBack("GENERATOR_DOCKER_SIZE", 1000000000);
          sandMessage.state = "SENDING_TAR_FROM_GENERATOR";

          const testStream = fs.createReadStream("./project.tar");
          testStream.on("data", (fileData) => {
            const streamToString = fileData.toString("base64");
            sandMessage.value = streamToString;
            ws.send(JSON.stringify(sandMessage));
          });
        } else if (jsonMessage.state === "DOWNLOAD_DONE_FROM_GENERATOR") {
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
