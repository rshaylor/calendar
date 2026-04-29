from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(tags=["rewards"])


def _balance(db: Session, member_id: int) -> int:
    earned = (
        db.query(func.coalesce(func.sum(models.ChoreCompletion.stars_awarded), 0))
        .filter(models.ChoreCompletion.member_id == member_id)
        .scalar()
    )
    spent = (
        db.query(func.coalesce(func.sum(models.Redemption.star_cost), 0))
        .filter(models.Redemption.member_id == member_id)
        .scalar()
    )
    adjusted = (
        db.query(func.coalesce(func.sum(models.StarAdjustment.amount), 0))
        .filter(models.StarAdjustment.member_id == member_id)
        .scalar()
    )
    return int(earned) + int(adjusted) - int(spent)


@router.get("/balances", response_model=list[schemas.Balance])
def list_balances(db: Session = Depends(get_db)):
    members = db.query(models.FamilyMember).order_by(models.FamilyMember.id).all()
    return [{"member_id": m.id, "stars": _balance(db, m.id)} for m in members]


@router.get("/rewards", response_model=list[schemas.RewardRead])
def list_rewards(db: Session = Depends(get_db)):
    return db.query(models.Reward).order_by(models.Reward.star_cost, models.Reward.id).all()


@router.post("/rewards", response_model=schemas.RewardRead, status_code=201)
def create_reward(payload: schemas.RewardCreate, db: Session = Depends(get_db)):
    reward = models.Reward(**payload.model_dump())
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return reward


@router.delete("/rewards/{reward_id}", status_code=204)
def delete_reward(reward_id: int, db: Session = Depends(get_db)):
    reward = db.get(models.Reward, reward_id)
    if not reward:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(reward)
    db.commit()


@router.post("/rewards/{reward_id}/redeem", response_model=schemas.RedemptionRead, status_code=201)
def redeem_reward(reward_id: int, payload: schemas.RedeemCreate, db: Session = Depends(get_db)):
    reward = db.get(models.Reward, reward_id)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    member = db.get(models.FamilyMember, payload.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    balance = _balance(db, member.id)
    if balance < reward.star_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough stars: have {balance}, need {reward.star_cost}",
        )

    redemption = models.Redemption(
        reward_id=reward.id,
        member_id=member.id,
        star_cost=reward.star_cost,
        reward_name=reward.name,
        reward_emoji=reward.emoji,
    )
    db.add(redemption)
    db.commit()
    db.refresh(redemption)
    return redemption


@router.get("/redemptions", response_model=list[schemas.RedemptionRead])
def list_redemptions(db: Session = Depends(get_db)):
    return (
        db.query(models.Redemption)
        .order_by(models.Redemption.redeemed_at.desc())
        .limit(50)
        .all()
    )


@router.get("/balances/{member_id}/history", response_model=list[schemas.HistoryEntry])
def member_history(
    member_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if limit < 1:
        limit = 1
    if limit > 500:
        limit = 500
    member = db.get(models.FamilyMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    entries: list[dict] = []

    completions = (
        db.query(models.ChoreCompletion)
        .filter(
            models.ChoreCompletion.member_id == member_id,
            models.ChoreCompletion.stars_awarded > 0,
        )
        .all()
    )
    for c in completions:
        chore = db.get(models.Chore, c.chore_id)
        entries.append(
            {
                "type": "chore",
                "amount": c.stars_awarded,
                "label": chore.name if chore else "Chore",
                "emoji": chore.emoji if chore else "✅",
                "at": c.completed_at,
            }
        )

    redemptions = (
        db.query(models.Redemption).filter(models.Redemption.member_id == member_id).all()
    )
    for r in redemptions:
        entries.append(
            {
                "type": "reward",
                "amount": -r.star_cost,
                "label": r.reward_name,
                "emoji": r.reward_emoji,
                "at": r.redeemed_at,
            }
        )

    adjustments = (
        db.query(models.StarAdjustment)
        .filter(models.StarAdjustment.member_id == member_id)
        .all()
    )
    for a in adjustments:
        entries.append(
            {
                "type": "adjust",
                "amount": a.amount,
                "label": a.reason or ("Bonus" if a.amount > 0 else "Deduction"),
                "emoji": "✨" if a.amount > 0 else "📉",
                "at": a.created_at,
            }
        )

    entries.sort(key=lambda e: e["at"], reverse=True)
    return entries[:limit]


@router.post(
    "/balances/{member_id}/adjust",
    response_model=schemas.StarAdjustmentRead,
    status_code=201,
)
def adjust_balance(
    member_id: int,
    payload: schemas.StarAdjustmentCreate,
    db: Session = Depends(get_db),
):
    member = db.get(models.FamilyMember, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if payload.amount == 0:
        raise HTTPException(status_code=400, detail="Amount must be non-zero")

    adjustment = models.StarAdjustment(
        member_id=member_id,
        amount=payload.amount,
        reason=(payload.reason or None),
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)
    return adjustment
