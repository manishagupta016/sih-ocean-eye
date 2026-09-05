import uuid

from pydantic import BaseModel, ConfigDict


class ModelVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    version: str
    trained_on: str
    metrics_json: dict
