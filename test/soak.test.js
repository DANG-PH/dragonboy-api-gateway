/**
 * TEST 2: Soak Test — 24/7 uptime validation
 * Target: Chạy 10 phút ở load ổn định để đo memory leak, connection exhaustion
 * CV metric: "System maintained X RPS for Y minutes with p99 < Zms"
 *
 * Chạy: k6 run soak.test.js
 * Note lại: p99_latency, error_rate_over_time, any_degradation
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const latency   = new Trend("soak_latency", true);
const errorRate = new Rate("soak_error_rate");

// Điều chỉnh STABLE_RPS = 70% của max bạn tìm được ở test 01
const STABLE_RPS = 1500;

export const options = {
  scenarios: {
    soak: {
      executor: "constant-arrival-rate",
      rate: STABLE_RPS,
      timeUnit: "1s",
      duration: "10m",      // 10 phút soak — đủ để detect memory leak
      preAllocatedVUs: 200,
      maxVUs: 600,
    },
  },
  thresholds: {
    http_req_failed:   ["rate<0.005"],  // stricter: error < 0.5% over sustained load
    http_req_duration: ["p(99)<1000"],  // p99 < 1s (cho phép spikes nhỏ)
    "http_req_duration{endpoint:leaderboard}": ["p(95)<400"],
  },
};

const BASE = "https://api.dangpham.id.vn";

const ENDPOINTS = [
  { url: `${BASE}/user/top10-vang`, tag: "leaderboard" },
  // Thêm các endpoint khác ở đây nếu có
];

export default function () {
  // Round-robin qua các endpoints để test realistic traffic mix
  const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  const res = http.get(ep.url, {
    tags: { endpoint: ep.tag },
  });

  const ok = check(res, {
    "status 200":   (r) => r.status === 200,
    "latency ok":   (r) => r.timings.duration < 1000,
  });

  latency.add(res.timings.duration);
  errorRate.add(!ok);
}