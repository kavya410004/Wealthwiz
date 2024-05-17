import express from "express";
import axios from "axios";
import { getTransactions, getBalAndExp, getCategories, getCategoryId, getCurrentAndPreviousTransactions, getPieChartData, getCurrentMonthData, getPreviousMonthData, isAmountUnderLimit } from "./controller.js";
import passport from "passport";
import db from "./database.js";
import bcrypt from "bcrypt";
import "./auth.js"; 
import env from "dotenv"; 
// import gpt from "./AImodel.js";

env.config();

const router = express.Router();
const saltRounds = parseInt(process.env.SALT_ROUNDS);
const apiUrl = 'https://api.hyperleap.ai';
let conversationId = "dfe68d5a-d3b6-4865-902a-317208cb470c";
let previousChats = [];
let currentResponses = [];


router.get("/",(req,res) => {
  res.redirect("/login");
});
router.get("/home",async (req,res)=>{
  if(req.isAuthenticated()){
    const user = req.user;
    let transactions = [];
    let categories = []
    try{
      const userDetails = await getBalAndExp(user.username);
      transactions = await getTransactions(user.username);
      if(transactions.length >= 5){
        transactions = transactions.slice(0,5);
      }
      try{
        categories = await getCategories(user.username);
      }catch(err){
        console.log("Error getting categories", err);
        res.render("index.ejs",{
          "name_of_user" : user.name_,
          "user_details" : userDetails,
          "recent_transactions" : transactions
        });
      }
      res.render("index.ejs",{
        "name_of_user" : user.name_,
        "user_details" : userDetails,
        "recent_transactions" : transactions,
        "categories" : categories
      });
    }catch(err){
      console.log("Error getting transactions ",err);
      res.render("index.ejs",{
        "name_of_user" : user.name_
      });
    }
  }else{
    res.redirect("/login");
  }
});
router.get("/history",async (req,res)=>{
  if(req.isAuthenticated()){
    let currentMonthTransactions = [];
    let previousTransactions = [];
    try{
      const result = await getCurrentAndPreviousTransactions(req.user.username);
      currentMonthTransactions = result[0];
      previousTransactions = result[1];
      res.render("history.ejs",{
        "current_month_transactions" : currentMonthTransactions,
        "previous_transactions" : previousTransactions
      });
    }catch(err){
      console.log(err);
      res.render("history.ejs");
    }
  }else{
    res.redirect("/login");
  }
});
router.get("/category",async (req,res)=>{
  if(req.isAuthenticated()){
    let categories = [];
    try{ 
      categories = await getCategories(req.user.username);
      res.render("category.ejs",{
        "categories" : categories
      });      
    }
    catch(err){
     console.log("Error getting categories", err);
     res.render("category.ejs",{
      "error" : "Catrgories could not be loaded at the moment. Please refresh. If this error persists please contact support."
     });
    }
  }else{
    res.redirect("/login");
  }
});
router.get("/account",(req,res)=>{
  if(req.isAuthenticated()){
    res.render("account.ejs",{
      "user": req.user
    });
  }else{
    res.redirect("/login");
  }
});
router.get("/reports",async (req,res)=>{
  if(req.isAuthenticated()){
    try{
      const currentMonthData = await getCurrentMonthData(req.user.username);
      const previousMonthData = await getPreviousMonthData(req.user.username);
      const pieData = await getPieChartData(req.user.username);
      console.log(currentMonthData);
      console.log(previousMonthData);
      res.render("reports.ejs",{
        pieData: JSON.stringify(pieData),
        categoryData: pieData,
        previousMonthData: JSON.stringify(previousMonthData),
        currentMonthData : JSON.stringify(currentMonthData)
      });
    }catch(err){
      console.log("Error getting data for plots",err);
      res.render("reports.ejs",{
        "errorMessage": "There was an error generating report, try again later."
      })
    }
  }else{
    res.redirect("/login");
  }
});
router.get("/login",(req,res)=>{
  res.render("login.ejs");
});
router.get("/signup",(req,res)=>{
  res.render("signup.ejs");
});
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/'); 
  });
});
router.post("/signup",async (req,res) => {
    const name = req.body.name;
    const username = req.body.username;
    const password = req.body.password;
    console.log(req.body);
    try {
      const checkResult = await db.query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);  
      if (checkResult.rows.length > 0) {
        res.send("Email already exists. Try logging in.");
      } else {
        //hashing the password and saving it in the database
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
          } else {
            console.log("Hashed Password:", hash);
            const result = await db.query(
              "INSERT INTO users (name_, username, userpassword) VALUES ($1, $2, $3) RETURNING *",
              [name, username, hash]
            );
            const user = result.rows[0];
            await db.query("INSERT INTO categories (category_name,username) VALUES ('Others',$1);",[
              username
            ]);
            req.login(user,(err) => {
              res.redirect("/home");
            });
          }
        });
      }
    } catch (err) {
      console.log(err);
      res.render("/signup");
    }
});
router.post("/login",  passport.authenticate("local",{
  successRedirect:"/home",
  failureRedirect:"/login"
}));

router.post("/home", async (req, res) => {
  if(req.isAuthenticated()){
    try{
      const user = req.user;
      const transaction = req.body;
      const username = req.user.username;
      const category = await getCategoryId(transaction.category,username);
      const categoryId =  category.category_id;
      const result = await db.query(
        "INSERT INTO transactions (transaction_name, transaction_type, transaction_amount, transaction_date, username, category_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *;",[
        transaction.expenditure,
        transaction.type,
        parseFloat(transaction.amount),
        transaction.date,
        username,
        categoryId
      ]);
      const isUnderLimit = await isAmountUnderLimit(username, categoryId);
      let transactions = [];
      let categories = [];
      if(isUnderLimit === false){
        try{
          const userDetails = await getBalAndExp(user.username);
          transactions = await getTransactions(user.username);
          if(transactions.length >= 5){
            transactions = transactions.slice(0,5);
          }
          try{
            categories = await getCategories(user.username);
            console.log(categories);
          }catch(err){
            console.log("Error getting categories", err);
            res.render("index.ejs",{
              "name_of_user" : user.name_,
              "user_details" : userDetails,
              "recent_transactions" : transactions,
              "showReminder" : true,
              "categoryExceeded" : transaction.category
            });
          }
          res.render("index.ejs",{
            "name_of_user" : user.name_,
            "user_details" : userDetails,
            "recent_transactions" : transactions,
            "categories" : categories,
            "showReminder" : true,
            "categoryExceeded" : transaction.category
          });
        }catch(err){
          console.log("Error getting transactions ",err);
          res.render("index.ejs",{
            "name_of_user" : user.name_,
            "showReminder" : true,
            "categoryExceeded" : transaction.category
          });
        }
      }else{
        res.redirect("/home");
      }
    }catch(err){
      console.log(err);
      res.redirect("/home")
    }
  }else{
    res.redirect( "/login" );
  }
});
router.post("/add-category", async (req,res) =>{
  if(req.isAuthenticated()){
    let username = req.user.username;
    const result =  await getCategories(username);
    let allCategories = [];
    result.forEach((item) => {
      allCategories.push(item.name);
    })
    if(!allCategories.includes(req.body.category)){
      let categoryName = req.body.category;
      let categoryLimit = (req.body.limit === "") ? null : parseFloat(req.body.limit);
      await db.query("INSERT INTO categories(category_name, username, category_limit) VALUES($1, $2, $3);",[
        categoryName,
        username,
        categoryLimit
      ]);
      res.redirect("/category");
    }else{
      res.redirect("/home");
    }
  }else{
    res.redirect("/login");
  }
});
router.post("/edit-category", async (req,res) => {
  if(req.isAuthenticated()){
    console.log(req.body);
    let categoryId = parseInt(req.body.category);
    let limit = parseInt(req.body.limit);
    try{
      await db.query("UPDATE categories SET category_limit=$1 WHERE category_id=$2",[
        limit,
        categoryId
      ]);
    }catch(err){
      console.log("Error editing limit: ", err);
    }finally{
      res.redirect("/category");
    }
  }else{
    res.redirect("/login");
  }
});
router.post("/delete-category", async (req,res) =>{
  if(req.isAuthenticated()){
    let categoryId = req.body.id;
    try{
      await db.query("DELETE FROM categories WHERE category_id=$1", [categoryId]);
      res.redirect("/category");
    }catch(err){
      console.log("Can not delete category.") 
      res.redirect("/home");
    }
  }else{
    res.redirect("/login");
  }
});
router.get("/chat",async (req,res)=>{
  if(req.isAuthenticated()){
    try{
      if(conversationId != null){
        previousChats = []; 
        const headers = {
          'Accept' : 'text/plain',
          'Content-Type': 'application/json',
          'x-hl-api-key': process.env.API_KEY
        };
        const url_endpoint = apiUrl + "/conversations/" + conversationId;
        const apiResponse = await axios.get( url_endpoint,  { headers });
        previousChats = apiResponse.data;
        console.log(previousChats);
        res.render("chatbot.ejs",{
          "previousChats": previousChats
        });
      }else{
        const url_endpoint = apiUrl + "/conversations/persona";
        const currentDate = new Date();
        const day = String(currentDate.getDate()).padStart(2, '0');
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const year = currentDate.getFullYear();
        const formattedDate = `${day}-${month}-${year}`;
        let expenses = [];
        try{
          const result = await getTransactions(req.user.name_);
          expenses = result;
        }catch(err){
          console.log("Error getting all transactions : ",err);
        }
        const headers = {
          'Accept' : 'text/plain',
          'Content-Type': 'application/json',
          'x-hl-api-key': process.env.API_KEY
        };
        const requestData= {
          "personaId": process.env.PERSONA_ID,
          "replacements": {
              "current_date": formattedDate,
              "user": req.user.name_,
              "expenses": expenses
          }
        }
        const apiResponse = await axios.post( url_endpoint, requestData, { headers });
        conversationId = apiResponse.conversationId;
        res.render("chatbot.ejs");  
      }
    }catch(err){
      console.log("Error fetching previous conversations. :", err);
      res.render("chatbot.ejs");    
    }
  }else{
    res.redirect("/login");
  }
});
router.post('/chat', async (req, res) => {
  if(req.isAuthenticated()){
    try{
      console.log("In post /chat");
      const message = req.body.message;
      let newObj = {
        "content" : message,
        "role" : "user"
      }
      currentResponses.push(newObj);
      const headers = {
        'Accept' : 'text/plain',
        'Content-Type': 'application/json',
        'x-hl-api-key': process.env.API_KEY,
        "App-CollectionId" : "12345"
      };  
      const requestData= {
        "message": message
      }  
      const url_endpoint = apiUrl + `/conversations/${conversationId}/continue-sync`
      const apiResponse = await axios.patch( url_endpoint, requestData, { headers });
      console.log("response result:");
      console.log(apiResponse);
      console.log(apiResponse.choice[0].message.content);
      res.redirect("/chat");
    }catch(err){
      console.log("error sending request:", err);
      res.redirect("/chat");
    }
  }else{
    res.redirect("/login");
  }
});
router.get("/recommend", async (req, res) => {
  if(req.isAuthenticated()){
    try{
      const result = await getBalAndExp(req.user.username);
      let balance = result.balance;
      res.render("recommendation.ejs",{
        "balance" : balance
      });
    }catch(err){
      console.log("Error fetching balance : ", err);
      res.render("recommendation.ejs");
    }
  }else{
    res.redirect("/login");
  }
});
router.post("/recommend", async (req,res) => {
  if(req.isAuthenticated()){
    try{
      // const apiResponse = await axios.post("http://127.0.0.1:5000/recommend", req.body );
      const result = await getBalAndExp(req.user.username);
      const Responses = [
        [
          {
              "average_return": "16.39%",
              "name": "UTI EQUITY",
              "type": "stock"
          },
          {
              "average_return": "13.93%",
              "name": "ELSS",
              "type": "stock"
          },
        ], [
          {
            "average_return": "22.23%",
            "name":   "Apple Inc.", 
            "type": "stock"
          } ,
          {
            "average_return":"53.25%",
            "name": "HDFC Fund",
            "type": "mutual_fund"
          }
        ]
  
      ]
      let balance = result.balance;
      let recommendationResult = [];
      if(req.body.risk_tolerance === 'low'){
        recommendationResult = Responses[0];
      }else if(req.body.risk_tolerance === 'moderate'){
        recommendationResult = Responses[1];
      }
      // let apiResult = JSON.stringify(apiResponse.data);
      // apiResult = apiResult.filter(item => !isNaN(item.name) && !isNaN(item.symbol));
      // apiResult = JSON.parse(apiResult);
      // let recommendations = apiResult[0];
      // console.log(apiResult);

      // if (!Array.isArray(apiResult)) {
      //   apiResult = []; // Set it as an empty array if it's not already an array
      // }
      res.render("recommendation.ejs",{
        "balance" : balance,
        "recommendationResult" : recommendationResult
      });
    }catch(err){
      console.log("Error fetching result from recommendation system API :", err);
      res.redirect("/recommend");
    }
  }else{
    res.redirect("/login");
  }
});

export default router;