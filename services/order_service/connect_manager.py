from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, role):
        await websocket.accept()
        if role not in self.connections:
            self.connections[role] = []
        self.connections[role].append(websocket)

    async def disconnect(self, websocket: WebSocket, role: str):
        if role in self.connections:
            self.connections[role].remove(websocket)

            # Clear empty list
            if not self.connections[role]:
                del self.connections[role]

    async def broadcast_to_role(self, message: dict, role: str):
        print(f"Broadcasting to role: {role}, Connections: {self.connections.get(role, [])}")
        if role in self.connections:
            for connection in self.connections[role]:
                try:
                    await connection.send_json(message)
                except Exception:
                    self.connections[role].remove(connection)

manager = ConnectionManager()