const tar = require("tar");

tar
  .x(
    // or tar.extract(
    {
      file: "docker.tar",
      strip: 1,
      C: "project",
    }
  )
  .then(() => {
    console.log("ok");
  });
