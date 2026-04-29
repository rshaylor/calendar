from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=list[schemas.FamilyMemberRead])
def list_members(db: Session = Depends(get_db)):
    return db.query(models.FamilyMember).order_by(models.FamilyMember.id).all()


@router.post("", response_model=schemas.FamilyMemberRead, status_code=201)
def create_member(payload: schemas.FamilyMemberCreate, db: Session = Depends(get_db)):
    member = models.FamilyMember(**payload.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.patch("/{member_id}", response_model=schemas.FamilyMemberRead)
def update_member(
    member_id: int,
    payload: schemas.FamilyMemberUpdate,
    db: Session = Depends(get_db),
):
    member = db.get(models.FamilyMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.get(models.FamilyMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(member)
    db.commit()
