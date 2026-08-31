import { useState } from "react";
import { getSelectedCandidate } from "../lib/chain";
import { dayOffset, formatDayBadge, formatDuration, jstHhmm } from "../lib/time";
import { usePlanner } from "../state/store";
import type { LegPlan, RouteCandidate } from "../types";

function TimeLabel(props: { iso?: string; travelDate: string; suffix: string }) {
  const { iso, travelDate, suffix } = props;
  if (!iso) return <span className="time-label empty">--:-- {suffix}</span>;
  const badge = formatDayBadge(dayOffset(iso, travelDate));
  return (
    <span className="time-label">
      {badge && <span className="day-badge">{badge}</span>}
      {jstHhmm(iso)} {suffix}
    </span>
  );
}

function fareText(fareYen: number | null): string {
  return fareYen === null ? "運賃情報なし" : `¥${fareYen.toLocaleString()}`;
}

function CandidateRow(props: {
  candidate: RouteCandidate;
  selected: boolean;
  locked: boolean;
  travelDate: string;
  onSelect: () => void;
}) {
  const { candidate, selected, locked, travelDate, onSelect } = props;
  const lineSummary = candidate.segments
    .map((s) => `${s.lineName ?? ""}${s.trainName ? ` ${s.trainName}` : ""}`)
    .join(" → ");
  return (
    <li className={`candidate${selected ? " selected" : ""}`}>
      <div className="candidate-times">
        <TimeLabel iso={candidate.departureAt} travelDate={travelDate} suffix="発" />
        <span className="candidate-arrow">→</span>
        <TimeLabel iso={candidate.arrivalAt} travelDate={travelDate} suffix="着" />
      </div>
      <div className="candidate-meta">
        <span>{formatDuration(candidate.durationMinutes)}</span>
        <span>乗換{candidate.transferCount}回</span>
        <span>{fareText(candidate.fareYen)}</span>
        <span className="demo-chip">🧪デモ</span>
      </div>
      <div className="candidate-line">{lineSummary}</div>
      {selected ? (
        <span className="selected-tag">{locked ? "🔒 選択中（固定）" : "✔ 選択中"}</span>
      ) : (
        <button className="btn mini primary" onClick={onSelect}>この便にする</button>
      )}
    </li>
  );
}

function LegBlock(props: { leg: LegPlan; fromName: string; toName: string }) {
  const { leg, fromName, toName } = props;
  const travelDate = usePlanner((s) => s.travelDate);
  const selectCandidate = usePlanner((s) => s.selectCandidate);
  const unlockLeg = usePlanner((s) => s.unlockLeg);
  const retryLeg = usePlanner((s) => s.retryLeg);
  const [open, setOpen] = useState(false);

  const selected = getSelectedCandidate(leg);
  const color = selected?.segments[0]?.color ?? "#D97FB8";

  let body: JSX.Element;
  if (leg.status === "loading") {
    body = <p className="leg-note loading">🔄 検索中…</p>;
  } else if (leg.status === "error" && leg.errorCode === "NO_ROUTE") {
    body = (
      <div className="leg-note error">
        <p>この時刻以降の経路が見つかりませんでした。</p>
        <button className="btn mini" onClick={() => retryLeg(leg.id)}>🔁 この区間だけ再試行</button>
      </div>
    );
  } else if (leg.status === "error") {
    body = (
      <div className="leg-note error">
        <p>交通データの取得に失敗しました。</p>
        <button className="btn mini" onClick={() => retryLeg(leg.id)}>🔁 この区間だけ再試行</button>
      </div>
    );
  } else if (leg.status === "idle" || !selected) {
    body = <p className="leg-note">未検索（「時刻を検索」を押してください）</p>;
  } else {
    body = (
      <div className="leg-body">
        {leg.status === "conflict" && (
          <p className="leg-note conflict">
            ⚠ 前の列車の到着後、この便には間に合いません。別の便を選ぶか、固定を解除してください。
          </p>
        )}
        {selected.segments.map((seg, i) => (
          <div className="segment" key={i}>
            {i > 0 && (
              <div className="transfer-note">🔁 {seg.fromName} で乗り換え</div>
            )}
            <div className="segment-line" style={{ color: seg.color }}>
              ● {seg.lineName} {seg.trainName && <strong>{seg.trainName}</strong>}
              {seg.headsign && <span className="headsign">（{seg.headsign}）</span>}
            </div>
            <div className="segment-times">
              <TimeLabel iso={seg.departureAt} travelDate={travelDate} suffix={`発 ${seg.fromName}`} />
              <span className="candidate-arrow">→</span>
              <TimeLabel iso={seg.arrivalAt} travelDate={travelDate} suffix={`着 ${seg.toName}`} />
            </div>
          </div>
        ))}
        <div className="candidate-meta">
          <span>{formatDuration(selected.durationMinutes)}</span>
          <span>乗換{selected.transferCount}回</span>
          <span>{fareText(selected.fareYen)}</span>
          <span className="demo-chip">🧪デモ</span>
          {leg.isLocked && (
            <button className="btn mini" onClick={() => unlockLeg(leg.id)}>🔓 固定を解除</button>
          )}
        </div>
        {leg.candidates.length > 1 && (
          <button className="btn mini ghost" onClick={() => setOpen(!open)}>
            {open ? "候補を閉じる ▲" : `他の候補を見る（${leg.candidates.length}件）▼`}
          </button>
        )}
        {open && (
          <ul className="candidate-list">
            {leg.candidates.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                selected={c.id === leg.selectedCandidateId}
                locked={leg.isLocked}
                travelDate={travelDate}
                onSelect={() => selectCandidate(leg.id, c.id)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={`leg leg-${leg.status}`} style={{ borderLeftColor: color }}>
      <div className="leg-title">
        {fromName} → {toName}
      </div>
      {body}
    </div>
  );
}

export default function Timeline() {
  const stops = usePlanner((s) => s.stops);
  const legs = usePlanner((s) => s.legs);
  const travelDate = usePlanner((s) => s.travelDate);
  const stale = usePlanner((s) => s.stale);

  if (stops.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">🚃 タイムライン</h2>
        <p className="hint">左で駅を追加してプランを作りましょう。</p>
      </div>
    );
  }

  const fetchedAt = legs
    .flatMap((l) => l.candidates.map((c) => c.fetchedAt))
    .sort()
    .pop();

  return (
    <div className={`card${stale ? " stale" : ""}`}>
      <h2 className="card-title">🚃 タイムライン</h2>
      {stale && <p className="hint">表示中の時刻は古い可能性があります。「時刻を検索」で更新してください。</p>}
      <div className="timeline">
        {stops.map((stop, i) => {
          const prevLeg = i > 0 ? legs[i - 1] : undefined;
          const nextLeg = i < legs.length ? legs[i] : undefined;
          const arrival = prevLeg ? getSelectedCandidate(prevLeg)?.arrivalAt : undefined;
          const departure = nextLeg ? getSelectedCandidate(nextLeg)?.departureAt : undefined;
          const isIntermediate = i > 0 && i < stops.length - 1;
          return (
            <div key={stop.id}>
              <div className="tl-station">
                <span className="tl-dot" />
                <div className="tl-station-main">
                  <div className="tl-station-name">{stop.station.name}</div>
                  <div className="tl-station-times">
                    {i > 0 && <TimeLabel iso={arrival} travelDate={travelDate} suffix="着" />}
                    {isIntermediate && (
                      <span className="stay-chip">🕐 この駅で{stop.stayMinutes}分</span>
                    )}
                    {i < stops.length - 1 && (
                      <TimeLabel iso={departure} travelDate={travelDate} suffix="発" />
                    )}
                  </div>
                </div>
              </div>
              {nextLeg && (
                <LegBlock
                  leg={nextLeg}
                  fromName={stop.station.name}
                  toName={stops[i + 1].station.name}
                />
              )}
            </div>
          );
        })}
      </div>
      {fetchedAt && (
        <p className="fetched-note">
          データ取得: {new Date(fetchedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          （デモデータ）／実際の運行は公式情報をご確認ください
        </p>
      )}
    </div>
  );
}
