import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  useExtraEarnings,
  useAddExtraEarning,
  useUpdateExtraEarning,
  useDeleteExtraEarning,
  EXTRA_EARNING_TYPES,
  typeLabel,
  type ExtraEarning,
} from "@/lib/useExtraEarnings";

// ─── Inline Form ─────────────────────────────────────────────────────────────
function EntryForm({
  date,
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  date: string;
  initial?: Partial<ExtraEarning>;
  onSave: (type: string, amount: number, note: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [type, setType]     = useState(initial?.type     ?? "tip_cash");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [note, setNote]     = useState(initial?.note     ?? "");

  const valid = type && parseFloat(amount) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: "hidden" }}
    >
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "16px",
        marginTop: 10,
      }}>

        {/* Type selector */}
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          Tipo
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {EXTRA_EARNING_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: type === t.value ? "1px solid #00ff88" : "1px solid rgba(255,255,255,0.1)",
                background: type === t.value ? "rgba(0,255,136,0.1)" : "transparent",
                color: type === t.value ? "#00ff88" : "rgba(255,255,255,0.5)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Valor
        </p>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)",
          }}>
            R$
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: "100%", height: 46, borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f9fafb", fontSize: 16, fontWeight: 700,
              fontFamily: "inherit", outline: "none",
              paddingLeft: 36, paddingRight: 14,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Note */}
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Observação <span style={{ fontWeight: 400, letterSpacing: 0, color: "rgba(255,255,255,0.2)" }}>(opcional)</span>
        </p>
        <input
          type="text"
          placeholder="Ex: corrida do aeroporto"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: "100%", height: 42, borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f9fafb", fontSize: 14,
            fontFamily: "inherit", outline: "none",
            padding: "0 14px", boxSizing: "border-box",
            marginBottom: 14,
          }}
        />

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 42, borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => valid && onSave(type, parseFloat(amount), note)}
            disabled={!valid || isSaving}
            style={{
              flex: 2, height: 42, borderRadius: 12, border: "none",
              background: valid && !isSaving ? "#00ff88" : "rgba(0,255,136,0.2)",
              color: valid && !isSaving ? "#000" : "rgba(0,255,136,0.4)",
              fontSize: 14, fontWeight: 800,
              cursor: valid && !isSaving ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({
  entry,
  date,
  onEdit,
  onDelete,
  isDeleting,
}: {
  entry: ExtraEarning;
  date: string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 1 }}>
          {typeLabel(entry.type)}
        </p>
        {entry.note && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.note}
          </p>
        )}
      </div>
      <span style={{ fontSize: 15, fontWeight: 800, color: "#4ade80", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        +{formatBRL(entry.amount)}
      </span>
      <button
        onClick={onEdit}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(255,255,255,0.35)", lineHeight: 0 }}
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={onDelete}
        disabled={isDeleting}
        style={{ background: "none", border: "none", cursor: isDeleting ? "not-allowed" : "pointer", padding: 4, color: isDeleting ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.6)", lineHeight: 0 }}
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRA EARNINGS SECTION
// ═══════════════════════════════════════════════════════════════════════════════
export function ExtraEarningsSection({
  date,
  appEarnings,
  collapsed = false,
}: {
  date: string;
  appEarnings?: number;
  collapsed?: boolean;
}) {
  const { data: entries = [], isLoading } = useExtraEarnings(date);
  const addMutation    = useAddExtraEarning();
  const updateMutation = useUpdateExtraEarning();
  const deleteMutation = useDeleteExtraEarning();

  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [expanded, setExpanded]       = useState(!collapsed);

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const trueTotal = (appEarnings ?? 0) + total;

  const handleAdd = async (type: string, amount: number, note: string) => {
    await addMutation.mutateAsync({ date, type, amount, note });
    setShowForm(false);
  };

  const handleUpdate = async (id: number, type: string, amount: number, note: string) => {
    await updateMutation.mutateAsync({ id, type, amount, note, date });
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id, date });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>

      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 0 12px 0", fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
            Ganhos extras
          </span>
          {total > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: "#4ade80",
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.18)",
              borderRadius: 20, padding: "2px 8px",
            }}>
              +{formatBRL(total)}
            </span>
          )}
        </div>
        <span style={{ color: "rgba(255,255,255,0.3)", lineHeight: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            {/* Separator */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 12 }} />

            {/* Entries list */}
            {isLoading ? (
              <div style={{ height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 10 }} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: entries.length > 0 ? 10 : 0 }}>
                <AnimatePresence>
                  {entries.map((entry) => (
                    editingId === entry.id ? (
                      <EntryForm
                        key={`form-${entry.id}`}
                        date={date}
                        initial={entry}
                        isSaving={updateMutation.isPending}
                        onSave={(t, a, n) => handleUpdate(entry.id, t, a, n)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        date={date}
                        onEdit={() => { setEditingId(entry.id); setShowForm(false); }}
                        onDelete={() => handleDelete(entry.id)}
                        isDeleting={deletingId === entry.id}
                      />
                    )
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Add form */}
            <AnimatePresence>
              {showForm && editingId === null && (
                <EntryForm
                  key="new-form"
                  date={date}
                  isSaving={addMutation.isPending}
                  onSave={handleAdd}
                  onCancel={() => setShowForm(false)}
                />
              )}
            </AnimatePresence>

            {/* Add button */}
            {!showForm && editingId === null && (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  width: "100%", height: 44, borderRadius: 14,
                  border: "1px dashed rgba(0,255,136,0.25)",
                  background: "rgba(0,255,136,0.03)",
                  color: "#00ff88",
                  fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginTop: entries.length > 0 ? 2 : 0,
                }}
              >
                <Plus size={15} />
                Adicionar ganho extra
              </button>
            )}

            {/* True total row — only show if appEarnings is passed AND extras exist */}
            {appEarnings !== undefined && entries.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  marginTop: 16,
                  background: "#0e0e0e",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Ganhos do app</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>
                    {formatBRL(appEarnings)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Ganhos extras</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>
                    +{formatBRL(total)}
                  </span>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>Total do dia</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#00ff88", fontVariantNumeric: "tabular-nums" }}>
                    {formatBRL(trueTotal)}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
