var { spawn, exec } = require("child_process");
// var Docker = require("dockerode");
// var docker = new Docker();

var imageName = "eee";
const test = (e) => {
  console.log(e);
  return "hello";
};

// const process = exec("docker build --tag test332:0.1 .");
// process.stdout.on("data", (data) => {
//   console.log(data.toString());
// });

// docker.buildImage({ context: __dirname + "/project" }, { tag: "dfdsf" }, (err, response) => {
//   console.log("done", err, response);
// });

let test2 = spawn("docker", ["build", "--tag", "t33est3332:0.1", "."]);
test2.stdout.on("data", function (msg) {
  console.log(msg.toString());
});

// let process = spawn("docker");
// // 3. 실행할 명령을 작성합니다.
// // '\n' 은 엔터입니다. terminal 이기 때문에 엔터로 명령어를 입력해야 실행되겠죠?
// const command = "build --tag test33:0.1 ."; // a: 숨긴 파일까지 , l: 자세한 내용까지 검색
// try {
//   // 4. 부모 프로세서에서 자식프로세서로 명령을 보냅니다.
//   process.stdin.write(command);

//   // stdin을 이용할때는 end()로 반드시 입력을 끝내야합니다.
//   process.stdin.end();
//   // 5. 명령이 모두 실행됐다면 'close' 이벤트가 발생합니다.
//   process.on("close", function (code) {
//     console.log("end");
//     // resolve(code);
//   });
// } catch (err) {
//   console.log("error");
//   reject(err);
// }
