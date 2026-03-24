require("dotenv").config();

module.exports = {
  jwtSecretKey: process.env.JWT_SECRET,
};