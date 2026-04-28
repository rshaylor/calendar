from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/chores", tags=["chores"])


def _start_of_today_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime.combine(now.date(), time.min, tzinfo=timezone.utc)


def _serialize(chore: models.Chore, db: Session) -> dict:
    today_start = _start_of_today_utc()
    done_today = (
        db.query(models.ChoreCompletion.member_id)
        .filter(
            models.ChoreCompletion.chore_id == chore.id,
            models.ChoreCompletion.completed_at >= today_start,
        )
        .all()
    )
    return {
        "id": chore.id,
        "name": chore.name,
        "emoji": chore.emoji,
        "star_value": chore.star_value,
        "recurrence": chore.recurrence,
        "weekdays": chore.weekdays,
        "time_of_day": chore.time_of_day,
        "assignees": chore.assignees,
        "done_today_by": [row[0] for row in done_today],
    }


@router.get("", response_model=list[schemas.ChoreRead])
def list_chores(db: Session = Depends(get_db)):
    chores = db.query(models.Chore).order_by(models.Chore.id).all()
    return [_serialize(c, db) for c in chores]


@router.post("", response_model=schemas.ChoreRead, status_code=201)
def create_chore(payload: schemas.ChoreCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"assignee_ids"})
    chore = models.Chore(**data)
    if payload.assignee_ids:
        members = (
            db.query(models.FamilyMember)
            .filter(models.FamilyMember.id.in_(payload.assignee_ids))
            .all()
        )
        chore.assignees = members
    db.add(chore)
    db.commit()
    db.refresh(chore)
    return _serialize(chore, db)


@router.delete("/{chore_id}", status_code=204)
def delete_chore(chore_id: int, db: Session = Depends(get_db)):
    chore = db.get(models.Chore, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(chore)
    db.commit()


@router.post("/{chore_id}/complete", response_model=schemas.ChoreCompletionRead, status_code=201)
def complete_chore(
    chore_id: int,
    payload: schemas.ChoreCompletionCreate,
    db: Session = Depends(get_db),
):
    chore = db.get(models.Chore, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    member = db.get(models.FamilyMember, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    today_start = _start_of_today_utc()
    existing = (
        db.query(models.ChoreCompletion)
        .filter(
            models.ChoreCompletion.chore_id == chore_id,
            models.ChoreCompletion.member_id == payload.member_id,
            models.ChoreCompletion.completed_at >= today_start,
        )
        .first()
    )
    if existing:
        return existing

    completion = models.ChoreCompletion(
        chore_id=chore_id,
        member_id=payload.member_id,
        stars_awarded=chore.star_value,
    )
    db.add(completion)
    db.commit()
    db.refresh(completion)
    return completion


@router.delete("/{chore_id}/complete/{member_id}", status_code=204)
def uncomplete_chore_today(chore_id: int, member_id: int, db: Session = Depends(get_db)):
    today_start = _start_of_today_utc()
    completion = (
        db.query(models.ChoreCompletion)
        .filter(
            models.ChoreCompletion.chore_id == chore_id,
            models.ChoreCompletion.member_id == member_id,
            models.ChoreCompletion.completed_at >= today_start,
        )
        .first()
    )
    if not completion:
        raise HTTPException(status_code=404, detail="Not completed today")
    db.delete(completion)
    db.commit()
