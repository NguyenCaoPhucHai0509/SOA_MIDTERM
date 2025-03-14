import os
from supabase import create_client, Client
import json

with open("config.json", "r") as file:
    config = json.load(file)

url: str = config["SUPABASE_URL"]
key: str = config["SUPABASE_KEY"]
supabase: Client = create_client(url, key)

# staff = (
#     supabase.table("staff")
#     .select("*")
#     .execute()
# )

# orders = (
#     supabase.table("orders")
#     .select("*")
#     .execute()
# )

# print(staff.data[0])
# print(orders.data[0])

response = (
    supabase.table("staff")
    .insert({"name": "Nguyen Van D", "role": "waiter"})
    .execute()
)

print(response)