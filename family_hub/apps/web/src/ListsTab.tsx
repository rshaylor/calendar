import { useEffect, useState } from "react";
import { api, type TodoItem, type TodoList } from "./api";
import Icon from "./Icon";
import { PRESET_LIST_COLORS, PRESET_LIST_EMOJIS, tint } from "./ui";

type FormState = { kind: "closed" } | { kind: "creating" } | { kind: "editing" };

export default function ListsTab() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({ kind: "closed" });

  async function loadLists() {
    const ls = await api.listLists();
    setLists(ls);
    if (ls.length > 0 && (activeId === null || !ls.find((l) => l.id === activeId))) {
      setActiveId(ls[0].id);
    } else if (ls.length === 0) {
      setActiveId(null);
    }
    setLoading(false);
  }

  async function loadItems(listId: number) {
    setItems(await api.listItems(listId));
  }

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    if (activeId !== null) loadItems(activeId);
  }, [activeId]);

  const active = lists.find((l) => l.id === activeId) ?? null;

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-6">
      <aside className="flex flex-col gap-1.5">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted px-3 mb-1">
          Lists
        </div>
        {lists.map((l) => {
          const isActive = l.id === activeId && form.kind === "closed";
          return (
            <button
              key={l.id}
              onClick={() => {
                setActiveId(l.id);
                setForm({ kind: "closed" });
              }}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition"
              style={{
                background: isActive ? tint(l.color, 0.28) : "transparent",
                border: `1px solid ${isActive ? tint(l.color, 0.45) : "transparent"}`,
              }}
            >
              <span
                className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-lg shrink-0"
                style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }}
              >
                {l.emoji}
              </span>
              <span className="flex-1 truncate font-semibold">{l.name}</span>
              {l.item_count - l.done_count > 0 && (
                <span className="text-xs font-bold bg-white text-ink px-2 py-0.5 rounded-full tabular-nums">
                  {l.item_count - l.done_count}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => setForm({ kind: "creating" })}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left text-ink-2 hover:bg-bg-2 font-semibold mt-1"
        >
          <span className="w-9 h-9 rounded-xl bg-bg-2 flex items-center justify-center shrink-0">
            <Icon name="plus" size={18} color="var(--color-ink-2)" />
          </span>
          New list
        </button>
      </aside>

      <main>
        {form.kind === "creating" ? (
          <ListForm
            onCancel={() => setForm({ kind: "closed" })}
            onSaved={async (created) => {
              setForm({ kind: "closed" });
              await loadLists();
              setActiveId(created.id);
            }}
          />
        ) : form.kind === "editing" && active ? (
          <ListForm
            initial={active}
            onCancel={() => setForm({ kind: "closed" })}
            onSaved={async () => {
              setForm({ kind: "closed" });
              await loadLists();
            }}
            onDeleted={async () => {
              setForm({ kind: "closed" });
              await api.deleteList(active.id);
              await loadLists();
            }}
          />
        ) : !active ? (
          <div className="rounded-3xl bg-surface border border-line p-10 text-center text-ink-2">
            <div className="w-14 h-14 rounded-2xl bg-bg-2 mx-auto mb-3 flex items-center justify-center">
              <Icon name="list" size={28} color="var(--color-ink-2)" />
            </div>
            <p className="mb-4">Create your first list — try "Grocery", "Packing", or "To-do".</p>
            <button
              onClick={() => setForm({ kind: "creating" })}
              className="px-5 py-2.5 rounded-2xl bg-ink text-white font-semibold shadow-sm"
            >
              + New list
            </button>
          </div>
        ) : (
          <ListView
            list={active}
            items={items}
            onChanged={async () => {
              if (activeId !== null) await loadItems(activeId);
              await loadLists();
            }}
            onEditList={() => setForm({ kind: "editing" })}
          />
        )}
      </main>
    </div>
  );
}

function ListView({
  list,
  items,
  onChanged,
  onEditList,
}: {
  list: TodoList;
  items: TodoItem[];
  onChanged: () => void;
  onEditList: () => void;
}) {
  const [newText, setNewText] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    await api.createItem(list.id, newText.trim());
    setNewText("");
    onChanged();
  }

  async function toggle(item: TodoItem) {
    await api.updateItem(item.id, { done: !item.done });
    onChanged();
  }

  async function rename(item: TodoItem, text: string) {
    if (!text.trim() || text === item.text) return;
    await api.updateItem(item.id, { text: text.trim() });
    onChanged();
  }

  async function remove(item: TodoItem) {
    await api.deleteItem(item.id);
    onChanged();
  }

  async function clearDone() {
    if (!confirm(`Remove ${doneCount} completed item(s)?`)) return;
    await api.clearDone(list.id);
    onChanged();
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div
      className="rounded-[28px] border overflow-hidden flex flex-col"
      style={{
        background: tint(list.color, 0.14),
        borderColor: tint(list.color, 0.4),
      }}
    >
      <div
        className="px-6 py-5 flex items-center gap-4"
        style={{ borderBottom: `1px solid ${tint(list.color, 0.4)}` }}
      >
        <div
          className="w-14 h-14 rounded-[18px] bg-white flex items-center justify-center text-3xl shrink-0"
          style={{ boxShadow: `0 0 0 3px ${tint(list.color, 0.5)}` }}
        >
          {list.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-3xl font-medium leading-none truncate">{list.name}</h2>
          <div className="text-sm text-ink-2 mt-1">
            {items.length === 0
              ? "Empty"
              : `${items.length - doneCount} left · ${doneCount} done`}
          </div>
        </div>
        <button
          onClick={onEditList}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:opacity-90"
          aria-label="Edit list"
        >
          <Icon name="edit" size={18} color="var(--color-ink-2)" />
        </button>
        {doneCount > 0 && (
          <button
            onClick={clearDone}
            className="px-3 py-2 text-sm rounded-full bg-white hover:bg-white/90 text-ink-2 hover:text-danger font-medium"
          >
            Clear done
          </button>
        )}
      </div>

      <ul className="px-3 py-3 space-y-1">
        {items.map((item) => (
          <ListItemRow
            key={item.id}
            item={item}
            onToggle={() => toggle(item)}
            onRename={(t) => rename(item, t)}
            onDelete={() => remove(item)}
          />
        ))}
      </ul>

      <form
        onSubmit={add}
        className="px-4 py-4 flex gap-2"
        style={{ borderTop: `1px solid ${tint(list.color, 0.4)}` }}
      >
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder={`Add item to ${list.name}…`}
          className="flex-1 px-4 py-3 rounded-full bg-white text-base"
          style={{ border: `1px solid ${tint(list.color, 0.4)}` }}
        />
        <button
          type="submit"
          disabled={!newText.trim()}
          className="px-5 py-3 rounded-full bg-ink text-white font-semibold disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </div>
  );
}

function ListItemRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: TodoItem;
  onToggle: () => void;
  onRename: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  function commit() {
    setEditing(false);
    if (text.trim() && text !== item.text) onRename(text.trim());
    else setText(item.text);
  }

  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/60 transition">
      <button
        onClick={onToggle}
        aria-label={item.done ? "Mark not done" : "Mark done"}
        className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center transition"
        style={{
          background: item.done ? "var(--color-ink)" : "white",
          border: `2px solid ${item.done ? "var(--color-ink)" : "rgba(0,0,0,0.15)"}`,
        }}
      >
        {item.done && <Icon name="check" size={16} stroke={3} color="white" />}
      </button>

      {editing ? (
        <input
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditing(false);
              setText(item.text);
            }
          }}
          className="flex-1 bg-transparent border-b border-line focus:outline-none focus:border-primary py-1 text-base"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={
            "flex-1 text-left py-1 truncate text-base " +
            (item.done ? "line-through text-muted" : "")
          }
        >
          {item.text}
        </button>
      )}

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition text-muted hover:text-danger w-8 h-8 rounded-full inline-flex items-center justify-center"
        aria-label="Delete item"
      >
        <Icon name="x" size={16} />
      </button>
    </li>
  );
}

function ListForm({
  initial,
  onCancel,
  onSaved,
  onDeleted,
}: {
  initial?: TodoList;
  onCancel: () => void;
  onSaved: (list: TodoList) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? PRESET_LIST_EMOJIS[0]);
  const [color, setColor] = useState(initial?.color ?? PRESET_LIST_COLORS[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (initial) {
      const updated = await api.updateList(initial.id, { name: name.trim(), emoji, color });
      onSaved(updated);
    } else {
      const created = await api.createList({ name: name.trim(), emoji, color });
      onSaved(created);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl bg-surface border border-line shadow-sm p-6 grid gap-5 max-w-2xl"
    >
      <h3 className="font-display text-2xl font-medium">{initial ? "Edit list" : "New list"}</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name"
        autoFocus
        className="px-4 py-3 rounded-xl bg-bg-2 border border-line text-lg"
      />
      <div>
        <div className="text-sm text-ink-2 mb-2">Emoji</div>
        <div className="flex gap-2 flex-wrap">
          {PRESET_LIST_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={
                "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition " +
                (emoji === e ? "ring-2 ring-primary bg-bg-2" : "hover:bg-bg-2")
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm text-ink-2 mb-2">Colour</div>
        <div className="flex gap-3">
          {PRESET_LIST_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={
                "w-9 h-9 rounded-full transition " +
                (color === c ? "ring-2 ring-offset-2 ring-ink/30" : "")
              }
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-5 py-2.5 rounded-2xl bg-ink text-white font-semibold shadow-sm"
        >
          {initial ? "Save changes" : "Create list"}
        </button>
        {onDeleted && (
          <button
            type="button"
            onClick={onDeleted}
            className="px-4 py-2.5 rounded-2xl text-danger hover:bg-danger/10"
          >
            Delete list
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto px-4 py-2.5 rounded-2xl text-ink-2 hover:bg-bg-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
