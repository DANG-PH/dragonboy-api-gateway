import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    find_max_rps: {
      executor: "ramping-arrival-rate",

      startRate: 100, // bắt đầu 100 request/s
      timeUnit: "1s",

      preAllocatedVUs: 50,
      maxVUs: 2000,

      stages: [
        { target: 200, duration: "30s" },
        { target: 500, duration: "30s" },
        { target: 1000, duration: "30s" },
        { target: 2000, duration: "30s" },
        { target: 5000, duration: "30s" },
      ],
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"], // fail <1%
    http_req_duration: ["p(95)<500"], // p95 latency <500ms
  },
};

export default function () {
  const res = http.get("https://ngocrongdark.com/user/top10-vang");

  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}