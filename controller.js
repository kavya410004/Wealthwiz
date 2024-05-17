import db from "./database.js";


//returns array of transactions of the specified username
export async function getTransactions(username){
  const result = await db.query("SELECT transaction_name AS name, transaction_type AS type, transaction_amount AS amount, TO_CHAR(transaction_date, 'DD-MM-YYYY') AS date, category_name AS category FROM (SELECT transactions.transaction_name, transactions.transaction_type, transactions.transaction_amount, transactions.transaction_date, transactions.username, categories.category_name FROM transactions JOIN categories ON transactions.category_id = categories.category_id ORDER BY transaction_date DESC) AS records WHERE records.username =$1 ;",[username]);
  console.log(result.rows);
  return result.rows;  
}
// returns the an oject containing username, balance, expense of the specified username
export async function getBalAndExp(username){
  const income = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username =$1 AND transaction_type='income';",[username]);
  let userIncome = income.rows[0].sum;
  const expense = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username =$1 AND transaction_type='expense' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE);",[username]);
  let userExpense = expense.rows[0].sum;
  let result = {
    "username" : username,
    "balance": userIncome - userExpense,
    "expense": userExpense
  };
  return result;
}
//returns a list of category objects of the specified username
export async function getCategories(username){
  const result = await db.query("SELECT category_id AS id, category_name AS name, category_limit AS limit FROM categories WHERE categories.username =$1 ORDER BY name;",[username]);
  return result.rows;
}
//gets the category of the specified category name and user
export async function getCategoryId(categoryName, username){
  const result = await db.query("SELECT category_id FROM categories WHERE category_name=$1 and username=$2;",[
    categoryName,
    username
  ]);
  return result.rows[0];
}
//returns the current month transactions array and previous transactions array in an array
export async function getCurrentAndPreviousTransactions(username){
  let currentMonthTransactions = [];
  let previousTransactions = [];
  let result = [];
  const allTransactions = await getTransactions(username);
  const present = new Date();
  let currentMonth = present.getMonth() + 1;
  let currentYear = present.getFullYear();
  for(let i = 0; i < allTransactions.length; i++){
    let transaction = allTransactions[i];
    let transactionMonth = parseInt(transaction.date.split('-')[1]);
    let transactionYear = parseInt(transaction.date.split('-')[2]);
    if(transactionMonth === currentMonth && transactionYear === currentYear){
      currentMonthTransactions.push(transaction);
    }else{
      previousTransactions.push(transaction);
    }
  }
  result.push(currentMonthTransactions);
  result.push(previousTransactions);
  return result;
}
// gets category wise expenses for the current month as data for pie chart
export async function getPieChartData(username){
  const result = await db.query("SELECT C.category_name AS category, SUM(T.transaction_amount) AS total_expense FROM transactions T JOIN categories C ON T.category_id = C.category_id WHERE T.username=$1 AND DATE_TRUNC('month', T.transaction_date) = DATE_TRUNC('month', CURRENT_DATE) AND T.transaction_type='expense' GROUP BY C.category_name;",[
    username
  ]);
  if(result.rows.length > 0){
    return result.rows;
  }else{
    return -1;
  }
}
export async function getCurrentMonthData(username){
  const expense = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username=$1 AND transaction_type='expense' AND DATE_TRUNC('month',transaction_date) = DATE_TRUNC('month', CURRENT_DATE) ;",[
    username
  ]);
  const income = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username=$1 AND transaction_type='income' AND DATE_TRUNC('month',transaction_date) = DATE_TRUNC('month', CURRENT_DATE) ;",[
    username
  ]);
  let result = {
    expenses: expense.rows[0].sum,
    income: income.rows[0].sum
  }
  return result;  
}
export async function getPreviousMonthData(username){
  const expense = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username=$1 AND transaction_type='expense' AND DATE_TRUNC('month',transaction_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');",[
    username
  ]);
  const income = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username=$1 AND transaction_type='income' AND DATE_TRUNC('month',transaction_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');",[
    username
  ]);
  let result = {
    expenses: expense.rows[0].sum,
    income: income.rows[0].sum
  }
  return result;  
}
// check is the  total expenses of a certain category is under the limit or not
export async function isAmountUnderLimit(username, categoryId){
  const result1= await db.query("SELECT category_limit FROM categories WHERE category_id = $1",[
    categoryId
  ]);
  let categoryLimit = result1.rows[0].category_limit;
  if(categoryLimit != null){
    const result2 = await db.query("SELECT C.category_name AS category, SUM(T.transaction_amount) AS total_expense FROM transactions T JOIN categories C ON T.category_id = C.category_id WHERE T.username=$1 AND DATE_TRUNC('month', T.transaction_date) = DATE_TRUNC('month', CURRENT_DATE) AND T.transaction_type='expense' AND T.category_id=$2 GROUP BY C.category_name;",[
      username,
      parseInt(categoryId)
    ]);
    let categoryExpenses = result2.rows[0].total_expense;
    if(parseInt(categoryExpenses) > parseInt(categoryLimit)){
      return false;
    }else{
      return true;
    }
  }else{
    return true;
  }
}