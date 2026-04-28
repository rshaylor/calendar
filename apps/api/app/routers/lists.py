from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/lists", tags=["lists"])


def _serialize_list(lst: models.TodoList, db: Session) -> dict:
    item_count = (
        db.query(func.count(models.TodoItem.id))
        .filter(models.TodoItem.list_id == lst.id)
        .scalar()
        or 0
    )
    done_count = (
        db.query(func.count(models.TodoItem.id))
        .filter(models.TodoItem.list_id == lst.id, models.TodoItem.done == True)  # noqa: E712
        .scalar()
        or 0
    )
    return {
        "id": lst.id,
        "name": lst.name,
        "emoji": lst.emoji,
        "color": lst.color,
        "position": lst.position,
        "item_count": int(item_count),
        "done_count": int(done_count),
    }


@router.get("", response_model=list[schemas.TodoListRead])
def list_lists(db: Session = Depends(get_db)):
    lists = (
        db.query(models.TodoList)
        .order_by(models.TodoList.position, models.TodoList.id)
        .all()
    )
    return [_serialize_list(l, db) for l in lists]


@router.post("", response_model=schemas.TodoListRead, status_code=201)
def create_list(payload: schemas.TodoListCreate, db: Session = Depends(get_db)):
    next_position = (
        db.query(func.coalesce(func.max(models.TodoList.position), -1)).scalar() + 1
    )
    lst = models.TodoList(**payload.model_dump(), position=next_position)
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return _serialize_list(lst, db)


@router.patch("/{list_id}", response_model=schemas.TodoListRead)
def update_list(list_id: int, payload: schemas.TodoListUpdate, db: Session = Depends(get_db)):
    lst = db.get(models.TodoList, list_id)
    if not lst:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(lst, k, v)
    db.commit()
    db.refresh(lst)
    return _serialize_list(lst, db)


@router.delete("/{list_id}", status_code=204)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    lst = db.get(models.TodoList, list_id)
    if not lst:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(lst)
    db.commit()


@router.get("/{list_id}/items", response_model=list[schemas.TodoItemRead])
def list_items(list_id: int, db: Session = Depends(get_db)):
    if not db.get(models.TodoList, list_id):
        raise HTTPException(status_code=404, detail="List not found")
    return (
        db.query(models.TodoItem)
        .filter(models.TodoItem.list_id == list_id)
        .order_by(models.TodoItem.done, models.TodoItem.position, models.TodoItem.id)
        .all()
    )


@router.post("/{list_id}/items", response_model=schemas.TodoItemRead, status_code=201)
def create_item(
    list_id: int, payload: schemas.TodoItemCreate, db: Session = Depends(get_db)
):
    if not db.get(models.TodoList, list_id):
        raise HTTPException(status_code=404, detail="List not found")
    next_position = (
        db.query(func.coalesce(func.max(models.TodoItem.position), -1))
        .filter(models.TodoItem.list_id == list_id)
        .scalar()
        + 1
    )
    item = models.TodoItem(
        list_id=list_id,
        text=payload.text,
        done=payload.done,
        position=next_position,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=schemas.TodoItemRead)
def update_item(item_id: int, payload: schemas.TodoItemUpdate, db: Session = Depends(get_db)):
    item = db.get(models.TodoItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.TodoItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()


@router.post("/{list_id}/clear-done", status_code=204)
def clear_done(list_id: int, db: Session = Depends(get_db)):
    if not db.get(models.TodoList, list_id):
        raise HTTPException(status_code=404, detail="List not found")
    db.query(models.TodoItem).filter(
        models.TodoItem.list_id == list_id,
        models.TodoItem.done == True,  # noqa: E712
    ).delete()
    db.commit()
