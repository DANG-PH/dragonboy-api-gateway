/**
 * TEST 2: Soak Test — 24/7 uptime validation (DIRECT APP - BYPASS NGINX)
 *
 * Mục tiêu:
 * - Xác định NGINX có phải bottleneck không
 * - Đo latency thật của app (không qua proxy)
 *
 * Chạy: k6 run soak-ip.test.js
 * Kết quả cần đọc:
 * - p95 / p99 / max latency
 */

import http from "k6/http";
import { check } from "k6";
import { Trend, Rate } from "k6/metrics";

const latency   = new Trend("soak_latency", true);
const errorRate = new Rate("soak_error_rate");

// 70% peak (giữ nguyên theo test trước)
const STABLE_RPS = 2000;

// 2 VPS app (DIRECT)
const ENDPOINTS = [
  { url: "http://103.116.52.222:3000/user/top10-vang", tag: "leaderboard" },
  { url: "http://103.116.52.219:3000/user/top10-vang", tag: "leaderboard" },
];

let i = 0;

export const options = {
  noConnectionReuse: true, // tránh dính 1 connection → 1 node

  scenarios: {
    soak: {
      executor: "constant-arrival-rate",
      rate: STABLE_RPS,
      timeUnit: "1s",
      duration: "10m",
      preAllocatedVUs: 200,
      maxVUs: 600,
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.005"],

    // global latency
    http_req_duration: ["p(99)<1000"],

    // endpoint latency
    "http_req_duration{endpoint:leaderboard}": ["p(95)<400"],
  },
};

export default function () {
  // round-robin để phân đều 2 VPS
  const ep = ENDPOINTS[i % ENDPOINTS.length];
  i++;

  const res = http.get(ep.url, {
    tags: { endpoint: ep.tag },
  });

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "latency ok": (r) => r.timings.duration < 1000,
  });

  latency.add(res.timings.duration);
  errorRate.add(!ok);
}