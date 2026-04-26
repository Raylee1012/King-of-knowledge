import os
from dotenv import load_dotenv
from flask import Flask, send_file, jsonify
from flask_cors import CORS

load_dotenv()
app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return send_file("index.html")

@app.route("/config")
def config():
    return jsonify({
        "gemini_key": os.getenv("GEMINI_API_KEY"),
        "supabase_url": os.getenv("SUPABASE_URL"),
        "supabase_key": os.getenv("SUPABASE_KEY")
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)