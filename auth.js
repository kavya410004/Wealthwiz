import passport from "passport";
import { Strategy } from "passport-local";
import db from "./database.js";
import bcrypt from "bcrypt";

passport.use(new Strategy(async function verify(username, password, cb){
  console.log("In strategy");
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedHashedPassword = user.userpassword;
      bcrypt.compare(password, storedHashedPassword, (err, result) => {
        if (err) {
          return cb(err);
        } else {
          if (result) {
            return cb(null, user);
          } else {
            return  cb(null, false);
          }
        }
      });
    } else {
      return cb("User not found.");
    }
  } catch (err) {
    return cb(err);
  }
}));

passport.serializeUser((user,cb) =>{
  cb(null,user);
});

passport.deserializeUser((user,cb) =>{
  cb(null,user);
});