const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const authKeys = require("../lib/authKeys");

const router = express.Router();

// ✅ SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { email, password, type } = req.body;

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert user
    const [result] = await pool.execute(
      "INSERT INTO users (email, password, type) VALUES (?, ?, ?)",
      [email, hashedPassword, type]
    );

    // ✅ get inserted user id
    const userId = result.insertId;

    // ✅ FIX: include id in token
    const token = jwt.sign(
      { id: userId, type },
      authKeys.jwtSecretKey
    );

    res.json({ token, type });
  } catch (err) {
    res.status(400).json(err);
  }
});

// ✅ LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, type: user.type },
      authKeys.jwtSecretKey
    );

    res.json({ token, type: user.type });
  } catch (err) {
    res.status(400).json(err);
  }
});

module.exports = router;