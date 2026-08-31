import { usePlanner } from "../state/store";

export default function TripSettings() {
  const travelDate = usePlanner((s) => s.travelDate);
  const departureTime = usePlanner((s) => s.departureTime);
  const setTravelDate = usePlanner((s) => s.setTravelDate);
  const setDepartureTime = usePlanner((s) => s.setDepartureTime);

  return (
    <div className="card">
      <h2 className="card-title">🗓 旅行の設定</h2>
      <div className="settings-row">
        <label className="field">
          <span className="field-label">旅行日</span>
          <input
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">出発時刻</span>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
