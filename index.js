import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import env from "dotenv";
import routes from "./routes.js";

const app = express();
const port = 3000;

env.config();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use("/",routes);

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});