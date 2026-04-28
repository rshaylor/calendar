from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/family", tags=["family"])

NAME_KEY = "family.name"
DEFAULT_NAME = "Family Hub"


def _get_name(db: Session) -> str:
    s = db.get(models.Setting, NAME_KEY)
    if s and s.value:
        return s.value
    return DEFAULT_NAME


@router.get("", response_model=schemas.FamilyInfo)
def get_family(db: Session = Depends(get_db)):
    return schemas.FamilyInfo(name=_get_name(db))


@router.put("", response_model=schemas.FamilyInfo)
def set_family(payload: schemas.FamilyInfo, db: Session = Depends(get_db)):
    name = payload.name.strip() or DEFAULT_NAME
    s = db.get(models.Setting, NAME_KEY)
    if s:
        s.value = name
    else:
        s = models.Setting(key=NAME_KEY, value=name)
        db.add(s)
    db.commit()
    return schemas.FamilyInfo(name=name)
