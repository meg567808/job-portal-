const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pool = require("../config/db");
const jwtAuth = require("../lib/jwtAuth");

const router = express.Router();


// ✅ RESUME STORAGE (FIXED PATH)
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/resume"));
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + ".pdf");
  },
});

const uploadResume = multer({ storage: resumeStorage });


// ✅ RESUME UPLOAD
router.post("/resume", jwtAuth, uploadResume.single("file"), async (req, res) => {
  try {
    const user = req.user;

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const url = `/host/resume/${req.file.filename}`;

    // ✅ SAVE TO DB
    await pool.execute(
      "UPDATE users SET resume = ? WHERE id = ?",
      [url, user.id]
    );

    res.json({
      message: "Resume uploaded successfully",
      url,
    });

  } catch (err) {
    console.error(err);   // 👈 helps debugging
    res.status(400).json({
      message: "Upload failed",
    });
  }
});


// ✅ PROFILE STORAGE (FIXED PATH)
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/profile"));
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
    cb(null, uuidv4() + ext);
  },
});

const uploadProfile = multer({ storage: profileStorage });


// ✅ PROFILE UPLOAD
router.post("/profile", uploadProfile.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    res.json({
      message: "Profile uploaded successfully",
      url: `/host/profile/${req.file.filename}`,
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({
      message: "Upload failed",
    });
  }
});

module.exports = router;