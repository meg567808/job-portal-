const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

// MySQL connection
require("./config/db");

const app = express();
const port = 4444;

// create folders
if (!fs.existsSync("./public")) fs.mkdirSync("./public");
if (!fs.existsSync("./public/resume")) fs.mkdirSync("./public/resume");
if (!fs.existsSync("./public/profile")) fs.mkdirSync("./public/profile");

// middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());

// routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/api", require("./routes/apiRoutes"));
app.use("/upload", require("./routes/uploadRoutes"));
app.use("/host", require("./routes/downloadRoutes"));

app.listen(port, () => {
  console.log(`Server started on port ${port}!`);
});