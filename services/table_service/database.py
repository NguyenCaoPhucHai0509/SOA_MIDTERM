from sqlmodel import SQLModel, Session, create_engine
import os

current_dir = os.path.dirname(__file__)
sqlite_url = f"sqlite:///{current_dir}/table_service.db"

# connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
