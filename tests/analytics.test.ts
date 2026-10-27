import {test} from "node:test";
import assert from "node:assert/strict";
import {dashboardWindow,colombiaDay,fillSalesDays,metricChange} from "../src/shared/analytics";
test("Ventanas móviles adyacentes tienen duración exacta y no se superponen",()=>{
  for(const days of [7,30,90] as const){const w=dashboardWindow(days,new Date("2026-10-04T21:00:00Z"));assert.equal(+w.end-+w.start,days*86400000);assert.equal(+w.previousEnd,+w.start);assert.equal(+w.start-+w.previousStart,days*86400000);}
});
test("Día colombiano cambia a las 05:00 UTC y la serie rellena solo el intervalo",()=>{
  assert.equal(colombiaDay("2026-10-04T04:59:59Z"),"2026-10-03");assert.equal(colombiaDay("2026-10-04T05:00:00Z"),"2026-10-04");
  const rows=fillSalesDays(new Date("2026-09-30T21:00:00Z"),new Date("2026-10-02T05:00:00Z"),[{date:"2026-10-01",salesCents:2500050,orders:1}]);
  assert.deepEqual(rows,[{date:"2026-09-30",salesCents:0,orders:0},{date:"2026-10-01",salesCents:2500050,orders:1}]);
  assert.equal(fillSalesDays(new Date("2026-09-27T21:00:00Z"),new Date("2026-10-04T21:00:00Z"),[]).length,8);
});
test("Las variaciones sin base son explícitas y los descensos conservan signo",()=>{
  assert.equal(metricChange(100,0),null);assert.equal(metricChange(0,0),null);assert.equal(metricChange(75,100),-25);assert.equal(metricChange(101,100),1);assert.equal(metricChange(0,100),-100);
});
