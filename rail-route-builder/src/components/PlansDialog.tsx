import { useState } from "react";
import { usePlanner } from "../state/store";

export default function PlansDialog(props: { onClose: () => void }) {
  const listPlans = usePlanner((s) => s.listPlans);
  const loadPlan = usePlanner((s) => s.loadPlan);
  const deletePlan = usePlanner((s) => s.deletePlan);
  const [version, setVersion] = useState(0);

  const plans = listPlans();
  void version;

  return (
    <div className="dialog-overlay" onClick={props.onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 className="card-title">📂 保存したプラン</h2>
          <button className="btn mini" onClick={props.onClose} aria-label="閉じる">✕</button>
        </div>
        {plans.length === 0 ? (
          <p className="hint">保存されたプランはまだありません。</p>
        ) : (
          <ul className="plan-list">
            {plans.map((p) => (
              <li key={p.id} className="plan-row">
                <div className="plan-info">
                  <div className="plan-name">{p.title || "（無題）"}</div>
                  <div className="plan-sub">
                    {p.travelDate}・{p.stops.length}駅・
                    {new Date(p.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} 保存
                  </div>
                </div>
                <div className="plan-actions">
                  <button
                    className="btn mini primary"
                    onClick={() => {
                      loadPlan(p.id);
                      props.onClose();
                    }}
                  >
                    読み込む
                  </button>
                  <button
                    className="btn mini danger"
                    onClick={() => {
                      if (window.confirm(`「${p.title || "（無題）"}」を削除しますか？`)) {
                        deletePlan(p.id);
                        setVersion((v) => v + 1);
                      }
                    }}
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
