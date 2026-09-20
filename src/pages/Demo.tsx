import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { CURRENCIES } from "../currencies";

/** The proof-of-concept tenant whose representative systems can be driven. */
const ORGANISATION_ID = "adb";

interface DemoCase {
  readonly creditNoteNo: string;
  readonly supplierId: string;
  readonly amount: number;
  readonly currency: string;
  readonly issuedDate: string;
  readonly voucherNo?: string;
  readonly refundChannel?: string;
  readonly treasuryReceipts: number;
}

interface Supplier {
  readonly supplierId: string;
  readonly supplierName: string;
  readonly country?: string;
  readonly category?: string;
}

interface FundSource {
  readonly fundSourceId: string;
  readonly name: string;
  readonly type: string;
  readonly currency: string;
}

interface LogEntry {
  readonly at: string;
  readonly text: string;
  readonly ok: boolean;
}

/**
 * Drives the representative source systems for a demonstration: each panel is
 * one thing that would happen in the real world, written as the records those
 * systems would hold. The portal assesses on request, so the case moves the
 * moment it is refreshed there.
 */
export default function Demo() {
  const { idToken } = useAuth();
  const [cases, setCases] = useState<DemoCase[]>([]);
  const [funds, setFunds] = useState<FundSource[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ cases: DemoCase[]; fundSources: FundSource[]; suppliers: Supplier[] }>(
        `/organisations/${ORGANISATION_ID}/demo/cases`,
        idToken(),
      );
      setCases(result.cases);
      setFunds(result.fundSources);
      setSuppliers(result.suppliers);
    } catch (cause) {
      note(cause instanceof ApiError ? cause.message : "Could not load the demonstration state.", false);
    }
  }, [idToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function note(text: string, ok: boolean) {
    setLog((entries) => [{ at: new Date().toISOString().slice(11, 19), text, ok }, ...entries].slice(0, 30));
  }

  async function send(panel: string, body: Record<string, unknown>) {
    setBusy(panel);
    try {
      const result = await api<{ summary: string }>(`/organisations/${ORGANISATION_ID}/demo/events`, idToken(), {
        method: "POST",
        body,
      });
      note(result.summary, true);
      await load();
    } catch (cause) {
      note(cause instanceof ApiError ? cause.message : "The event was not applied.", false);
    } finally {
      setBusy(null);
    }
  }

  function submit(panel: string, shape: (data: Record<string, string>) => Record<string, unknown>) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
      void send(panel, shape(data)).then(() => {
        if (panel === "credit-note") form.reset();
      });
    };
  }

  async function reset(clearDecisions: boolean) {
    if (!window.confirm(`Remove every record of ${ORGANISATION_ID} from the source systems${clearDecisions ? " and its decisions" : ""}, then reload the ten seeded cases?`)) return;
    setBusy("reset");
    try {
      const result = await api<{ removed: number; decisionsRemoved: number; records: number }>(
        `/organisations/${ORGANISATION_ID}/demo/reset`,
        idToken(),
        { method: "POST", body: { clearDecisions } },
      );
      note(`Reset: removed ${result.removed} items${clearDecisions ? ` and ${result.decisionsRemoved} decisions` : ""}, loaded ${result.records} records.`, true);
      await load();
    } catch (cause) {
      note(cause instanceof ApiError ? cause.message : "Reset failed.", false);
    } finally {
      setBusy(null);
    }
  }

  const withVoucher = cases.filter((c) => c.voucherNo);
  const withoutVoucher = cases.filter((c) => !c.voucherNo);
  const CaseOptions = ({ items }: { items: DemoCase[] }) => (
    <>
      {items.map((c) => (
        <option key={c.creditNoteNo} value={c.creditNoteNo}>
          {c.creditNoteNo} · {c.amount.toLocaleString("en-US")} {c.currency}
          {c.voucherNo ? ` · ${c.voucherNo}` : ""}
          {c.treasuryReceipts ? ` · ${c.treasuryReceipts} receipt${c.treasuryReceipts === 1 ? "" : "s"}` : ""}
        </option>
      ))}
    </>
  );

  return (
    <>
      <div className="page-head">
        <h2>Demonstration</h2>
        <p>
          These panels write what {ORGANISATION_ID.toUpperCase()}&rsquo;s source systems would record when something
          happens. Open the case in the portal afterwards: it is assessed on request, so it reflects the new evidence
          straight away.
        </p>
      </div>

      <div className="demo-grid">
        <div className="demo-panels">
          <section className="card">
            <h3>1 · Supplier issues a credit note</h3>
            <p className="muted small">Creates the contract, invoice and credit note in Procurement and Disbursement, with the credit note PDF. A new case appears.</p>
            <form
              onSubmit={submit("credit-note", (d) => ({
                type: "credit-note",
                supplierId: d.supplierId === "__new__" ? undefined : d.supplierId,
                supplierName: d.supplierId === "__new__" ? d.supplierName : undefined,
                fundSourceId: d.fundSourceId,
                currency: d.currency,
                invoiceAmount: Number(d.invoiceAmount),
                creditAmount: Number(d.creditAmount),
                reason: d.reason,
              }))}
            >
              <div className="contact-grid">
                <label className="field">
                  <span>Supplier</span>
                  <select name="supplierId" required onChange={(e) => setNewSupplier(e.target.value === "__new__")}>
                    {suppliers.map((s) => (
                      <option key={s.supplierId} value={s.supplierId}>
                        {s.supplierName}{s.country ? ` · ${s.country}` : ""} ({s.supplierId})
                      </option>
                    ))}
                    <option value="__new__">New supplier…</option>
                  </select>
                </label>
                {newSupplier && (
                  <label className="field">
                    <span>New supplier&rsquo;s name</span>
                    <input name="supplierName" required placeholder="Northern Rail Consultants" />
                  </label>
                )}
                <label className="field">
                  <span>Paid from</span>
                  <select name="fundSourceId" required>
                    {funds.map((f) => (
                      <option key={f.fundSourceId} value={f.fundSourceId}>
                        {f.name} ({f.type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Currency</span>
                  <select name="currency" defaultValue="USD">
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="contact-grid">
                <label className="field">
                  <span>Invoice amount</span>
                  <input name="invoiceAmount" type="number" min="1" step="0.01" required defaultValue="50000" />
                </label>
                <label className="field">
                  <span>Credit note amount</span>
                  <input name="creditAmount" type="number" min="1" step="0.01" required defaultValue="7500" />
                </label>
                <label className="field">
                  <span>Reason</span>
                  <input name="reason" required defaultValue="Milestone 2 partially delivered" />
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy !== null}>
                {busy === "credit-note" ? "Writing…" : "Issue credit note"}
              </button>
            </form>
          </section>

          <section className="card">
            <h3>2 · Disbursement raises a refund voucher</h3>
            <p className="muted small">The case moves to awaiting Treasury confirmation.</p>
            <form
              onSubmit={submit("voucher", (d) => ({
                type: "refund-voucher",
                creditNoteNo: d.creditNoteNo,
                refundMethod: d.refundMethod,
                refundChannel: d.refundChannel,
              }))}
            >
              <div className="contact-grid">
                <label className="field">
                  <span>Case (no voucher yet)</span>
                  <select name="creditNoteNo" required disabled={withoutVoucher.length === 0}>
                    <CaseOptions items={withoutVoucher} />
                  </select>
                </label>
                <label className="field">
                  <span>Method</span>
                  <select name="refundMethod" defaultValue="electronic">
                    <option value="electronic">electronic</option>
                    <option value="cash">cash</option>
                    <option value="cheque">cheque</option>
                  </select>
                </label>
                <label className="field">
                  <span>Channel</span>
                  <select name="refundChannel" defaultValue="bank-transfer">
                    <option value="bank-transfer">bank transfer</option>
                    <option value="cash-room">Cash Room</option>
                    <option value="cheque-deposit">cheque deposit</option>
                  </select>
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy !== null || withoutVoucher.length === 0}>
                {busy === "voucher" ? "Writing…" : "Raise voucher"}
              </button>
            </form>
          </section>

          <section className="card">
            <h3>3 · Treasury confirmation arrives</h3>
            <p className="muted small">
              Leave amount, currency and reference blank to match the case. Change any of them to stage an amount,
              currency or reference mismatch. Untick &ldquo;confirmed&rdquo; for a receipt Treasury has not yet confirmed.
            </p>
            <form
              onSubmit={submit("treasury", (d) => ({
                type: "treasury-receipt",
                creditNoteNo: d.creditNoteNo,
                amount: d.amount ? Number(d.amount) : undefined,
                currency: d.currency || undefined,
                referenceNo: d.referenceNo || undefined,
                confirmed: d.confirmed === "on",
                channel: d.channel,
                withBankAdvice: d.withBankAdvice === "on",
              }))}
            >
              <div className="contact-grid">
                <label className="field">
                  <span>Case (with voucher)</span>
                  <select name="creditNoteNo" required disabled={withVoucher.length === 0}>
                    <CaseOptions items={withVoucher} />
                  </select>
                </label>
                <label className="field">
                  <span>Amount received <em>(blank = credit note)</em></span>
                  <input name="amount" type="number" min="0.01" step="0.01" />
                </label>
                <label className="field">
                  <span>Currency <em>(blank = credit note)</em></span>
                  <select name="currency" defaultValue="">
                    <option value="">same as credit note</option>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="contact-grid">
                <label className="field">
                  <span>Reference quoted <em>(blank = voucher)</em></span>
                  <input name="referenceNo" placeholder="VCH-2026-0011" />
                </label>
                <label className="field">
                  <span>Channel</span>
                  <select name="channel" defaultValue="wire">
                    <option value="wire">wire</option>
                    <option value="cash-room">Cash Room</option>
                    <option value="cheque">cheque</option>
                  </select>
                </label>
                <div className="field checks-inline">
                  <label>
                    <input name="confirmed" type="checkbox" defaultChecked /> confirmed by Treasury
                  </label>
                  <label>
                    <input name="withBankAdvice" type="checkbox" defaultChecked /> with bank credit advice
                  </label>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy !== null || withVoucher.length === 0}>
                {busy === "treasury" ? "Writing…" : "Record Treasury receipt"}
              </button>
            </form>
          </section>

          <section className="card">
            <h3>4 · Cash Room records a deposit</h3>
            <form
              onSubmit={submit("cashroom", (d) => ({
                type: "cashroom-deposit",
                creditNoteNo: d.creditNoteNo,
                amount: d.amount ? Number(d.amount) : undefined,
                currency: d.currency || undefined,
                withDepositSlip: d.withDepositSlip === "on",
              }))}
            >
              <div className="contact-grid">
                <label className="field">
                  <span>Case (with voucher)</span>
                  <select name="creditNoteNo" required disabled={withVoucher.length === 0}>
                    <CaseOptions items={withVoucher} />
                  </select>
                </label>
                <label className="field">
                  <span>Amount <em>(blank = credit note)</em></span>
                  <input name="amount" type="number" min="0.01" step="0.01" />
                </label>
                <div className="field checks-inline">
                  <label>
                    <input name="withDepositSlip" type="checkbox" defaultChecked /> with deposit slip
                  </label>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy !== null || withVoucher.length === 0}>
                {busy === "cashroom" ? "Writing…" : "Record deposit"}
              </button>
            </form>
          </section>

          <section className="card">
            <h3>5 · A document is uploaded</h3>
            <form onSubmit={submit("document", (d) => ({ type: "document", creditNoteNo: d.creditNoteNo, kind: d.kind }))}>
              <div className="contact-grid">
                <label className="field">
                  <span>Case</span>
                  <select name="creditNoteNo" required disabled={cases.length === 0}>
                    <CaseOptions items={cases} />
                  </select>
                </label>
                <label className="field">
                  <span>Document</span>
                  <select name="kind" defaultValue="bank-advice">
                    <option value="credit-note">credit note</option>
                    <option value="bank-advice">bank credit advice</option>
                    <option value="deposit-slip">deposit slip</option>
                    <option value="treasury-confirmation">Treasury confirmation</option>
                  </select>
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy !== null || cases.length === 0}>
                {busy === "document" ? "Writing…" : "Upload document"}
              </button>
            </form>
          </section>

          <section className="card">
            <h3>Reset representative data</h3>
            <p className="muted small">
              Removes everything in the source systems for {ORGANISATION_ID.toUpperCase()} and reloads the ten seeded
              cases. Decisions are kept unless you say otherwise; the organisation and its users are never touched.
            </p>
            <div className="contact-actions">
              <button className="btn btn-secondary" type="button" onClick={() => void reset(false)} disabled={busy !== null}>
                {busy === "reset" ? "Resetting…" : "Reset source data"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => void reset(true)} disabled={busy !== null}>
                Reset source data and decisions
              </button>
            </div>
          </section>
        </div>

        <aside className="demo-side">
          <section className="card">
            <h3>Cases in the source systems</h3>
            {cases.length === 0 ? (
              <p className="muted">None.</p>
            ) : (
              <ul className="history">
                {cases.map((c) => (
                  <li key={c.creditNoteNo}>
                    <b>{c.creditNoteNo}</b> · {c.amount.toLocaleString("en-US")} {c.currency}
                    <div className="muted small">
                      {c.voucherNo ? `${c.voucherNo} (${c.refundChannel})` : "no voucher"}
                      {c.treasuryReceipts > 0 && ` · ${c.treasuryReceipts} Treasury receipt${c.treasuryReceipts === 1 ? "" : "s"}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h3>Log</h3>
            {log.length === 0 ? (
              <p className="muted">Nothing yet.</p>
            ) : (
              <ul className="history">
                {log.map((entry, index) => (
                  <li key={index} className={entry.ok ? "" : "stale"}>
                    <span className="muted small">{entry.at}</span> {entry.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
