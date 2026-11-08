import { describe, expect, it } from "vitest";
import { fdDate, fdExtraSeason, fdRow, omKickoff, omRow, parseCsv, seasonCode, seasonOf, zonedToUtc } from "../../supabase/functions/ta-sync/parse";

describe("CSV", () => {
  it("gestisce BOM, virgolette e a-capo", () => {
    const rows = parseCsv('﻿a,b,c\r\n1,"x, y",3\r\n4,"riga\nnuova","""q"""\r\n\r\n');
    expect(rows).toEqual([{ a: "1", b: "x, y", c: "3" }, { a: "4", b: "riga\nnuova", c: '"q"' }]);
  });
  it("ultima riga senza a-capo", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([{ a: "1", b: "2" }]);
  });
});

describe("date e orari", () => {
  it("date football-data a 2 e 4 cifre", () => {
    expect(fdDate("22/08/26")).toBe("2026-08-22");
    expect(fdDate("5/1/2025")).toBe("2025-01-05");
    expect(fdDate("2025-01-05")).toBeUndefined();
  });
  it("ora inglese → UTC con ora legale", () => {
    expect(zonedToUtc("2026-01-10", "15:00", "Europe/London")).toBe("2026-01-10T15:00:00.000Z");
    expect(zonedToUtc("2026-08-22", "17:30", "Europe/London")).toBe("2026-08-22T16:30:00.000Z");
  });
  it("Open Matchday usa UTC+1 fisso", () => {
    expect(omKickoff("2026-11-06", "20:45")).toBe("2026-11-06T19:45:00.000Z");
    expect(omKickoff("2026-08-22", "17:30")).toBe("2026-08-22T16:30:00.000Z");
  });
  it("le due fonti danno lo stesso calcio d'inizio per Inter–Monza", () => {
    const fd = fdRow({ Date: "22/08/2026", Time: "17:30", HomeTeam: "Inter", AwayTeam: "Monza", FTHG: "4", FTAG: "1" })!;
    const om = omRow({ date: "2026-08-22", time: "17:30", home: "Internazionale", away: "Monza", ft_home: "4", ft_away: "1" })!;
    expect(fd.kickoff).toBe(om.kickoff);
  });
  it("stagioni", () => {
    expect(seasonOf("2026-11-08")).toBe("2026/27");
    expect(seasonOf("2027-05-30")).toBe("2026/27");
    expect(seasonOf("2026-07-01")).toBe("2026/27");
    expect(seasonCode("2026/27")).toBe("2627");
    expect(fdExtraSeason("2025/2026")).toBe("2025/26");
  });
});

describe("righe partite", () => {
  it("football-data: quote medie con ripiego e campi vuoti eliminati", () => {
    const r = fdRow({ Date: "01/09/2025", HomeTeam: "A", AwayTeam: "B", FTHG: "2", FTAG: "2", HTHG: "", B365H: "2.10", "B365>2.5": "1.9", PSCH: "2.05", BFECH: "2.12" })!;
    expect(r).toMatchObject({ fthg: 2, ftag: 2, o_h: 2.1, o_o25: 1.9, c_h: 2.05, bf_h: 2.12 });
    expect("hthg" in r).toBe(false);
    expect("kickoff" in r).toBe(false);
  });
  it("file 'new' (Danimarca/Romania)", () => {
    const r = fdRow({ Country: "Denmark", Season: "2025/2026", Date: "18/07/2025", Time: "18:00", Home: "Aarhus", Away: "Odense", HG: "2", AG: "0" })!;
    expect(r).toMatchObject({ home: "Aarhus", away: "Odense", fthg: 2, ftag: 0, match_date: "2025-07-18", kickoff: "2025-07-18T17:00:00.000Z" });
  });
  it("valori fuori scala scartati", () => {
    const r = fdRow({ Date: "01/09/2025", HomeTeam: "A", AwayTeam: "B", FTHG: "x", FTAG: "-1", AvgH: "0.5" })!;
    expect(r.fthg).toBeUndefined(); expect(r.ftag).toBeUndefined(); expect(r.o_h).toBeUndefined();
  });
  it("Open Matchday con statistiche", () => {
    const r = omRow({ date: "2026-08-22", time: "", home: "X", away: "Y", ft_home: "1", ft_away: "0", home_corners: "7", away_corners: "3" })!;
    expect(r).toMatchObject({ fthg: 1, ftag: 0, co_h: 7, co_a: 3 });
    expect(r.kickoff).toBeUndefined();
  });
});
