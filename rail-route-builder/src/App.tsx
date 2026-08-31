import { useState } from "react";
import MapPicker from "./components/MapPicker";
import PlansDialog from "./components/PlansDialog";
import StationSearch from "./components/StationSearch";
import StopList from "./components/StopList";
import SummaryPanel from "./components/SummaryPanel";
import Timeline from "./components/Timeline";
import TripSettings from "./components/TripSettings";
import { usePlanner } from "./state/store";

type DockKey = "plan" | "result";

export default function App() {
  const title = usePlanner((s) => s.title);
  const setTitle = usePlanner((s) => s.setTitle);
  const stops = usePlanner((s) => s.stops);
  const legs = usePlanner((s) => s.legs);
  const searching = usePlanner((s) => s.searching);
  const stale = usePlanner((s) => s.stale);
  const notice = usePlanner((s) => s.notice);
  const searchAll = usePlanner((s) => s.searchAll);
  const savePlan = usePlanner((s) => s.savePlan);
  const newPlan = usePlanner((s) => s.newPlan);

  const [plansOpen, setPlansOpen] = useState(false);
  const [open, setOpen] = useState<Record<DockKey, boolean>>({ plan: true, result: true });
  const [mobileTab, setMobileTab] = useState<DockKey>("plan");

  const toggle = (key: DockKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const hasResult = legs.some((l) => l.candidates.length > 0);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🌸 鉄道路線プランナー</div>
        <input
          className="plan-title"
          placeholder="プラン名（例: 吉野日帰り旅）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="topbar-actions">
          <button className="btn primary" onClick={savePlan} title="保存">
            💾<span className="btn-label"> 保存</span>
          </button>
          <button className="btn" onClick={() => setPlansOpen(true)} title="読込">
            📂<span className="btn-label"> 読込</span>
          </button>
          <button
            className="btn"
            title="新規作成"
            onClick={() => {
              if (stops.length === 0 || window.confirm("入力中のプランを消して新規作成しますか？")) {
                newPlan();
              }
            }}
          >
            🆕<span className="btn-label"> 新規</span>
          </button>
        </div>
      </header>

      <div className="stage">
        <MapPicker />

        <nav className="mobile-tabs">
          <button
            className={mobileTab === "plan" ? "active" : ""}
            onClick={() => setMobileTab("plan")}
          >
            🧭 プラン（{stops.length}駅）
          </button>
          <button
            className={mobileTab === "result" ? "active" : ""}
            onClick={() => setMobileTab("result")}
          >
            🚃 時刻{hasResult ? "" : "（未検索）"}
          </button>
        </nav>

        <aside
          className={`dock dock-left${open.plan ? "" : " collapsed"}${
            mobileTab === "plan" ? " mobile-active" : ""
          }`}
        >
          <button className="dock-handle" onClick={() => toggle("plan")}>
            <span>🧭 プランを組む</span>
            <span className="dock-caret">{open.plan ? "◀" : "▶"}</span>
          </button>
          {open.plan && (
            <div className="dock-body">
              <TripSettings />
              <StationSearch />
              <StopList />
            </div>
          )}
          {open.plan && (
            <div className="dock-footer">
              {stale && stops.length >= 2 && (
                <p className="hint">内容が変わりました。もう一度検索してください。</p>
              )}
              <button
                className="btn primary big"
                disabled={stops.length < 2 || searching}
                onClick={() => void searchAll(0)}
              >
                {searching ? "🔄 検索中…" : "🕐 時刻を検索"}
              </button>
              {stops.length < 2 && (
                <p className="hint">地図の駅をタップして2件以上追加してください。</p>
              )}
            </div>
          )}
        </aside>

        <aside
          className={`dock dock-right${open.result ? "" : " collapsed"}${
            mobileTab === "result" ? " mobile-active" : ""
          }`}
        >
          <button className="dock-handle" onClick={() => toggle("result")}>
            <span className="dock-caret">{open.result ? "▶" : "◀"}</span>
            <span>🚃 旅程と時刻</span>
          </button>
          {open.result && (
            <div className="dock-body">
              <SummaryPanel />
              <Timeline />
            </div>
          )}
        </aside>
      </div>

      <div className="demo-banner">
        🧪 デモモード：時刻・運賃は架空データです／地図・駅は © OpenStreetMap contributors、線路は国土数値情報（国土交通省）を加工
      </div>

      {notice && <div className="notice">{notice}</div>}
      {plansOpen && <PlansDialog onClose={() => setPlansOpen(false)} />}
    </div>
  );
}
