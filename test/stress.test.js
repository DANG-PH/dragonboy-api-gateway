/**
 * TEST 1: Find Max RPS — Top 10 leaderboard API
 * Target: GET /user/top10-vang
 * CV metric: "Sustained X RPS at p95 < Yms, error < Z%"
 *
 * Chạy: k6 run stress.test.js
 * Note lại: max_rps_no_error, p95_at_stable_rps, error_spike_rps
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const p95Latency   = new Trend("p95_custom",   true);
const errorRate    = new Rate("error_rate");
const successCount = new Counter("success_total");

export const options = {
  scenarios: {
    find_max_rps: {
      executor: "ramping-arrival-rate",
      startRate: 50,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 3000,
      stages: [
        { target: 100,  duration: "20s" },  // warm-up
        { target: 300,  duration: "30s" },  // low load
        { target: 600,  duration: "30s" },  // medium load
        { target: 1000, duration: "30s" },  // high load
        { target: 1500, duration: "30s" },  // stress
        { target: 2000, duration: "30s" },  // peak stress
        { target: 3000, duration: "30s" },  // beyond limit (find breaking point)
        { target: 0,    duration: "20s" },  // cool down
      ],
    },
  },
  thresholds: {
    // Thresholds để k6 mark pass/fail — dùng làm cơ sở viết CV
    http_req_failed:   ["rate<0.01"],   // error < 1%
    http_req_duration: ["p(95)<500"],   // p95 < 500ms
  },
};

const BASE = "https://api.dangpham.id.vn";

export default function () {
  const res = http.get(`${BASE}/user/top10-vang`, {
    tags: { endpoint: "top10_vang" },
  });

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "has data":   (r) => r.body && r.body.length > 10,
    "p95 < 500ms":(r) => r.timings.duration < 500,
  });

  p95Latency.add(res.timings.duration);
  errorRate.add(!ok);
  if (ok) successCount.add(1);
}