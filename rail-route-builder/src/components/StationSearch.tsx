import { useEffect, useRef, useState } from "react";
import { mockProvider } from "../providers/mock-provider";
import { usePlanner } from "../state/store";
import type { Station } from "../types";

export default function StationSearch() {
  const stops = usePlanner((s) => s.stops);
  const addStation = usePlanner((s) => s.addStation);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mySeq = ++seq.current;
    const timer = setTimeout(async () => {
      const found = await mockProvider.searchStations(q);
      if (seq.current === mySeq) {
        setResults(found);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const full = stops.length >= 10;

  const pick = (station: Station) => {
    addStation(station);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="card">
      <h2 className="card-title">🚉 駅を追加</h2>
      <input
        className="station-input"
        placeholder="駅名を入力（例: 名古屋、よしの）"
        value={query}
        disabled={full}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length > 0) pick(results[0]);
        }}
      />
      {full && <p className="hint">駅は最大10件までです。</p>}
      {loading && <p className="hint">検索中…</p>}
      {!loading && query.trim().length > 0 && results.length === 0 && (
        <p className="hint">駅名を確認するか、都道府県名も入力してください。</p>
      )}
      {results.length > 0 && (
        <ul className="suggestions">
          {results.map((st) => (
            <li key={st.id}>
              <button className="suggestion" onClick={() => pick(st)}>
                <span className="suggestion-name">{st.name}</span>
                <span className="suggestion-sub">{st.secondaryText}</span>
                <span className="suggestion-add">＋追加</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
