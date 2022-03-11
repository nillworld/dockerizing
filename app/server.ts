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
      let dockerImgName = "";
      let dockerImgTag = "";
      let downloadedFileSize = 0;
      let downloadedPercent = "";
      let tarFile: fs.StatsBase<number>;
      let fileName = "";
      let fileSize = 0;

      let messageHandler = true;

      this.clients.push(ws);
      console.log("Connected total:", this.clients.length);

      ws.on("message", (message: any) => {
        const senderToBack = (state: string, value?: any) => {
          sandMessage.state = state;
          if (value) {
            sandMessage.value = value;
          }
          ws.send(JSON.stringify(sandMessage));
        };

        try {
          JSON.parse(message);
          messageHandler = true;
        } catch (error) {
          messageHandler = false;
        }
        if (messageHandler) {
          const jsonMessage = JSON.parse(message);
          // console.log(jsonMessage);
          if (jsonMessage.state === "GENERATOR_START") {
          } else if (jsonMessage.state === "MAKE_DOCKER_FILE") {
            exec("mkdir project", (err, out, stderr) => {
              console.log(err);
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
          } else if (jsonMessage.state === "SET_FILE_INFO") {
            fileName = jsonMessage.fileName;
            fileSize = jsonMessage.fileSize;
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
            senderToBack("SET_FILE_INFO");
          } else if (jsonMessage.state === "SET_DOCKER_NAME") {
            dockerImgName = jsonMessage.value;
            senderToBack("SET_DOCKER_NAME");
          } else if (jsonMessage.state === "SET_DOCKER_TAG") {
            dockerImgTag = jsonMessage.value;
            senderToBack("SET_DOCKER_TAG");
          } else if (jsonMessage.state === "GENERATOR_TAR_DECOMPRESS") {
            tar
              .x({
                file: "./project/project.tar",
                C: "./project",
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
            // <Docker Multi-Archtecture Image set>
            // 먼저 멀티 빌더 셋팅
            // docker buildx create --name [builder instance 명] --driver [드라이버 이름] --use
            // > docker buildx create --name multi-arch-builder --driver docker-container --use multi-arch-builder
            // 멀티 환경으로 도커 빌드
            // > docker buildx build --platform linux/amd64,linux/arm/v7 -f ./project/Dockerfile -t test:0.1 --push .
            const dockerBuild = spawn("docker", [
              "build",
              "--platform",
              jsonMessage.value,
              "-f",
              "./project/Dockerfile",
              "-t",
              `${dockerImgName}:${dockerImgTag}`,
              ".",
            ]);
            // dockerBuild.stdout.on("data", (message) => {
            // console.log("stdout", message.toString());
            // });
            dockerBuild.stderr.on("data", (message) => {
              const dockerBuildDoneMessage =
                "Use 'docker scan' to run Snyk tests against images to find vulnerabilities and learn how to fix them";
              const dockerDemonErrorMessage =
                "This error may indicate that the docker daemon is not running.";
              const dockerBuildErrorMessage = "executor failed running";
              const dockerBuildErrorMessage2 =
                "failed to solve with frontend dockerfile";
              console.log("message: ", message.toString());
              if (message.toString().indexOf(dockerBuildDoneMessage) >= 0) {
                try {
                  deleteFolderRecursive("./project");
                  console.log(`project dir is deleted!`);
                  downloadedFileSize = 0;
                  senderToBack("GENERATOR_DOCKER_BUILD_DONE");
                } catch (err) {
                  console.error(`Error while deleting project dir.`);
                }
              }
              if (message.toString().indexOf(dockerDemonErrorMessage) >= 0) {
                try {
                  deleteFolderRecursive("./project");
                  downloadedFileSize = 0;
                  senderToBack("GENERATOR_DOCKER_DEMON_ERROR");
                } catch (err) {
                  console.error(`Error while deleting project dir.`);
                }
              }
              if (
                message.toString().indexOf(dockerBuildErrorMessage) >= 0 ||
                message.toString().indexOf(dockerBuildErrorMessage2) >= 0
              ) {
                try {
                  deleteFolderRecursive("./project");
                  downloadedFileSize = 0;
                  senderToBack("GENERATOR_DOCKER_BUILD_ERROR");
                } catch (err) {
                  console.error(`Error while deleting project dir.`);
                }
              }
            });
          } else if (jsonMessage.state === "GENERATOR_DOCKER_SAVE") {
            spawnSync("docker", [
              "save",
              "-o",
              "project.tar",
              `${dockerImgName}:${dockerImgTag}`,
            ]);
            spawn("docker", ["rmi", `${dockerImgName}:${dockerImgTag}`]);
            console.log(
              "도커 이미지 tar로 save 완료 및 docker 이미지 삭제 완료. "
            );
            senderToBack("GENERATOR_DOCKER_SAVE_DONE");

            // load 커맨드> docker load -i project.tar
          } else if (jsonMessage.state === "SEND_FILE_SIZE_FROM_GENERATOR") {
            const dockerizedFile = fs.statSync("project.tar");
            const dockerizedSize = dockerizedFile.size;
            console.log("project tar file size: ", dockerizedSize);
            senderToBack("GENERATOR_DOCKER_SIZE", dockerizedSize);
          } else if (jsonMessage.state === "SEND_TAR_FROM_GENERATOR") {
            const streamDockeriedFile = fs.createReadStream("./project.tar", {
              highWaterMark: 1048576 * 16,
            });
            streamDockeriedFile.on("data", (fileData) => {
              ws.send(fileData);
            });
            streamDockeriedFile.on("end", () => {
              senderToBack("DONE_SENDING_TAR_FROM_GENERATOR");
              fs.unlinkSync("./project.tar");
            });
          } else if (jsonMessage.state === "DOWNLOAD_DONE_FROM_GENERATOR") {
          }
        } else {
          fs.appendFileSync(`./project/${fileName}`, message);
          downloadedFileSize += message.length;
          downloadedPercent = `${Math.round(
            (downloadedFileSize / fileSize) * 100
          )}%`;
          senderToBack("DOWNLOADING_FROM_BACK", downloadedPercent);
        }
      });
    });
    this.wss.on("close", function (error: any) {
      console.log("websever close", error);
    });
    this.wss.on("error", function (error: any) {
      console.log(error);
    });

    const deleteFolderRecursive = function (path: string) {
      if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
          const curPath = path + "/" + file;
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteFolderRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });

        fs.rmdirSync(path);
      }
    };
  }
}
