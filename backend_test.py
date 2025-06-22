import requests
import unittest
import json
from datetime import datetime

# Backend URL from the frontend .env file
BACKEND_URL = "https://8ed5b59c-7c02-4284-be27-8da4be859ebc.preview.emergentagent.com"
API_URL = f"{BACKEND_URL}/api"

class AShareAppAPITest(unittest.TestCase):
    """Test cases for A-share stock viewing application API"""

    def test_01_api_root(self):
        """Test the API root endpoint"""
        print("\n🔍 Testing API root endpoint...")
        response = requests.get(f"{API_URL}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("message", data)
        print(f"✅ API root endpoint test passed: {data['message']}")

    def test_02_stocks_search_default(self):
        """Test the stocks search endpoint with default parameters"""
        print("\n🔍 Testing stocks search endpoint (default)...")
        response = requests.get(f"{API_URL}/stocks/search")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("stocks", data)
        self.assertTrue(len(data["stocks"]) > 0, "No stocks returned in default search")
        print(f"✅ Default stocks search test passed: {len(data['stocks'])} stocks returned")
        
        # Verify stock data structure
        stock = data["stocks"][0]
        required_fields = ["code", "name", "current_price", "change_percent", "change_amount"]
        for field in required_fields:
            self.assertIn(field, stock, f"Field {field} missing from stock data")
        
        print(f"✅ Stock data structure validation passed")

    def test_03_stocks_search_with_query(self):
        """Test the stocks search endpoint with a specific query"""
        query = "平安银行"
        print(f"\n🔍 Testing stocks search endpoint with query '{query}'...")
        response = requests.get(f"{API_URL}/stocks/search?query={query}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("stocks", data)
        
        # Verify that results contain the query term
        if len(data["stocks"]) > 0:
            found = False
            for stock in data["stocks"]:
                if query in stock["name"] or query in stock["code"]:
                    found = True
                    break
            self.assertTrue(found, f"Search results don't contain the query term '{query}'")
            print(f"✅ Search with query '{query}' test passed: {len(data['stocks'])} matching stocks found")
        else:
            print(f"⚠️ No stocks found for query '{query}', but API responded correctly")

    def test_04_kline_data(self):
        """Test the K-line data endpoint"""
        stock_code = "000001"  # 平安银行
        print(f"\n🔍 Testing K-line data endpoint for stock {stock_code}...")
        response = requests.get(f"{API_URL}/stocks/{stock_code}/kline")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("kline_data", data)
        self.assertTrue(len(data["kline_data"]) > 0, "No K-line data returned")
        
        # Verify K-line data structure
        kline = data["kline_data"][0]
        required_fields = ["timestamp", "open", "high", "low", "close", "volume"]
        for field in required_fields:
            self.assertIn(field, kline, f"Field {field} missing from K-line data")
        
        print(f"✅ K-line data test passed: {len(data['kline_data'])} data points returned")

    def test_05_technical_indicators(self):
        """Test the technical indicators endpoint"""
        stock_code = "000001"  # 平安银行
        print(f"\n🔍 Testing technical indicators endpoint for stock {stock_code}...")
        response = requests.get(f"{API_URL}/stocks/{stock_code}/indicators")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("indicators", data)
        
        # Verify indicators data
        indicators = data["indicators"]
        expected_indicators = ["ma", "rsi", "macd"]
        for indicator in expected_indicators:
            self.assertIn(indicator, indicators, f"Indicator {indicator} missing from response")
        
        # Check MA indicator structure
        if "ma" in indicators:
            ma = indicators["ma"]
            self.assertIn("ma5", ma)
            self.assertIn("ma10", ma)
            self.assertIn("ma20", ma)
            self.assertIn("timestamps", ma)
            
        # Check RSI indicator structure
        if "rsi" in indicators:
            rsi = indicators["rsi"]
            self.assertIn("values", rsi)
            self.assertIn("timestamps", rsi)
            
        # Check MACD indicator structure
        if "macd" in indicators:
            macd = indicators["macd"]
            self.assertIn("macd", macd)
            self.assertIn("signal", macd)
            self.assertIn("histogram", macd)
            self.assertIn("timestamps", macd)
        
        print(f"✅ Technical indicators test passed")

    def test_06_hot_stocks(self):
        """Test the hot stocks endpoint"""
        print("\n🔍 Testing hot stocks endpoint...")
        response = requests.get(f"{API_URL}/market/hot")
        
        # This endpoint might fail if akshare has issues, so we'll handle both success and failure
        if response.status_code == 200:
            data = response.json()
            self.assertIn("hot_stocks", data)
            if len(data["hot_stocks"]) > 0:
                print(f"✅ Hot stocks test passed: {len(data['hot_stocks'])} hot stocks returned")
            else:
                print("⚠️ Hot stocks endpoint returned empty list, but API responded correctly")
        else:
            print(f"⚠️ Hot stocks endpoint returned status code {response.status_code}. This might be expected if akshare is having issues.")

if __name__ == "__main__":
    print(f"🧪 Running API tests against {API_URL}")
    unittest.main(argv=['first-arg-is-ignored'], exit=False)