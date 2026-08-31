import { computeTotals } from "../lib/totals";
import { dayOffset, formatDayBadge, formatDuration, jstHhmm } from "../lib/time";
import { usePlanner } from "../state/store";

export default function SummaryPanel() {
  const stops = usePlanner((s) => s.stops);
  const legs = usePlanner((s) => s.legs);
  const travelDate = usePlanner((s) => s.travelDate);
  const totals = computeTotals(stops, legs);

  if (legs.length === 0 || !totals.departureAt) {
    return (
      <div className="card summary">
        <h2 className="card-title">📋 旅程の概要</h2>
        <p className="hint">「時刻を検索」を押すと、ここに旅程の概要が表示されます。</p>
      </div>
    );
  }

  const arrivalBadge = totals.arrivalAt
    ? formatDayBadge(dayOffset(totals.arrivalAt, travelDate))
    : "";

  const fareText = totals.anyFareKnown
    ? `約¥${totals.fareKnownYen.toLocaleString()}${totals.fareMissing ? "（一部未取得）" : ""}`
    : "運賃情報なし";

  return (
    <div className="card summary">
      <h2 className="card-title">📋 旅程の概要{totals.complete ? "" : "（計算中）"}</h2>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">出発</span>
          <span className="summary-value">{jstHhmm(totals.departureAt)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">到着</span>
          <span className="summary-value">
            {totals.arrivalAt ? `${arrivalBadge}${jstHhmm(totals.arrivalAt)}` : "--:--"}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">合計</span>
          <span className="summary-value">
            {totals.totalMinutes !== undefined ? formatDuration(totals.totalMinutes) : "—"}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">移動</span>
          <span className="summary-value">{formatDuration(totals.moveMinutes)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">滞在</span>
          <span className="summary-value">{formatDuration(totals.stayMinutes)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">乗換</span>
          <span className="summary-value">{totals.transferCount}回</span>
        </div>
        <div className="summary-item wide">
          <span className="summary-label">運賃（概算）</span>
          <span className="summary-value">{fareText}</span>
        </div>
      </div>
    </div>
  );
}
