from decimal import Decimal
from datetime import datetime

def make_json_serializable(data):
    if isinstance(data, dict):
        return {k: make_json_serializable(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [make_json_serializable(item) for item in data]
    elif isinstance(data, Decimal):
        return float(data)  # Or str(data) for precision
    elif isinstance(data, datetime):
        return data.isoformat()
    return data