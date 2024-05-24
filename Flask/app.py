from flask import Flask, request, jsonify
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
app = Flask(__name__)

def get_investment_recommendations(amount, risk_tolerance, stocks, mutual_funds, model):
    # Combine all investment options
    investments = pd.concat([
        stocks.assign(type='stock'),
        mutual_funds.assign(type='mutual_fund')
    ])

    # Filter based on risk tolerance
    if risk_tolerance == 'high':
        suitable_investments = investments[investments['volatility'] > 0.25]
    elif risk_tolerance == 'moderate':
        suitable_investments = investments[(investments['volatility'] > 0.1) & (investments['volatility'] <= 0.3)]
    else:
        suitable_investments = investments[investments['volatility'] <= 0.1]

    if suitable_investments.empty:
        return {"message": "No suitable investments found for risk tolerance: " + risk_tolerance}

    # Prepare features for the model
    X = suitable_investments[['average_return', 'volatility']]
    le = LabelEncoder()
    y = le.fit_transform(suitable_investments['type'])

    # Train the model
    model.fit(X, y)

    # Predict probabilities
    probabilities = model.predict_proba(X)

    # Debugging: Print the shape of probabilities array
    print("Shape of probabilities array:", probabilities.shape)

    # Check if probabilities array has only one column
    if probabilities.shape[1] == 1:
        return {"message": "Model is trained for binary classification. Ensure training data has multiple classes."}

    # Select top 3 recommendations
    top_indices = np.argsort(probabilities[:, 1])[::-1][:3]  # Assuming second column represents class 1
    recommendations_df = suitable_investments.iloc[top_indices]

    # Convert recommendations to list of dictionaries
    recommendations = recommendations_df.to_dict(orient='records')

    return {"recommendations": recommendations}

    # Combine all investment options
    investments = pd.concat([
        stocks.assign(type='stock'),
        mutual_funds.assign(type='mutual_fund')
    ])

    # Filter based on risk tolerance
    if risk_tolerance == 'high':
        suitable_investments = investments[investments['volatility'] > 0.25]
    elif risk_tolerance == 'moderate':
        suitable_investments = investments[(investments['volatility'] > 0.1) & (investments['volatility'] <= 0.3)]
    else:
        suitable_investments = investments[investments['volatility'] <= 0.1]

    if suitable_investments.empty:
        return {"message": "No suitable investments found for risk tolerance: " + risk_tolerance}

    # Prepare features for the model
    X = suitable_investments[['average_return', 'volatility']]
    le = LabelEncoder()
    y = le.fit_transform(suitable_investments['type'])

    # Train the model
    model.fit(X, y)

    # Predict probabilities
    probabilities = model.predict_proba(X)

    # Debugging: Print the shape of probabilities array
    print("Shape of probabilities array:", probabilities.shape)

    # Check if probabilities array has only one column
    if probabilities.shape[1] == 1:
        return {"message": "Model is trained for binary classification. Ensure training data has multiple classes."}

    # Select top 3 recommendations
    top_indices = np.argsort(probabilities[:, 1])[::-1][:3]  # Assuming second column represents class 1
    recommendations = suitable_investments.iloc[top_indices]

    return recommendations.to_dict(orient='records')


@app.route('/recommend', methods=['POST'])
def recommend():
    print("in recommend/")
    print(request)
    data = request.get_json(force=True)
    amount_left = float(data['amount_left']) or 5000
    risk_tolerance = data['risk_tolerance'] or "low"

    # Load the model
    model = RandomForestClassifier(n_estimators=100, random_state=42)

    # Simulated data
    stocks_data = {
        'symbol': ['AAPL', 'GOOG', 'AMZN', 'MSFT', 'TSLA'],
        'average_return': np.random.rand(5) * 0.2,  # Simulated average returns
        'volatility': np.random.rand(5) * 0.5  # Simulated volatility
    }

    mutual_funds_data = {
        'name': ['FundA', 'FundB', 'FundC', 'FundD', 'FundE'],
        'average_return': np.random.rand(5) * 0.1,
        'volatility': np.random.rand(5) * 0.2
    }

    # Convert simulated data to DataFrame
    stocks = pd.DataFrame(stocks_data)
    mutual_funds = pd.DataFrame(mutual_funds_data)

    # Get investment recommendations
    recommendations = get_investment_recommendations(amount_left, risk_tolerance, stocks, mutual_funds, model)

    return jsonify(recommendations)

if __name__ == '__main__':
    app.run(debug=True)