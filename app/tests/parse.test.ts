import { describe, expect, it } from "vitest";
import { fdDate, fdExtraSeason, fdRow, goalMinutes, goalsByMatch, withGoalSides, omKickoff, omRow, parseCsv, seasonCode, seasonOf, zonedToUtc } from "../../supabase/functions/ta-sync/parse";

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

describe("minuti dei gol (Open Matchday)", () => {
  it("normalizza recuperi e casi limite", () => {
    expect(goalMinutes("12,49,90+3", 3)).toBe("12,49,93");
    expect(goalMinutes("", 0)).toBe("");
    expect(goalMinutes("", 2)).toBeUndefined();
    expect(goalMinutes(undefined, 2)).toBeUndefined();
    expect(goalMinutes("12,abc", 2)).toBeUndefined();
    expect(goalMinutes("29", 2)).toBe("29"); // incompleto: lo decide l'app
  });
  it("omRow aggiunge goal_min solo se la colonna esiste", () => {
    const base = { date: "2026-11-08", time: "15:30", home: "A", away: "B", ft_home: "2", ft_away: "1", ht_home: "1", ht_away: "0" };
    expect(omRow({ ...base, goal_minutes: "5,60,88" })!.goal_min).toBe("5,60,88");
    expect(omRow(base)!.goal_min).toBeUndefined();
    expect(omRow({ ...base, ft_home: "0", ft_away: "0", goal_minutes: "" })!.goal_min).toBe("");
  });
});

describe("chi ha segnato (file dei gol)", () => {
  const g = (minute: string, sh: string, sa: string, scorer = "X") => ({ date: "2026-11-20", home: "Darmstadt", away: "Heidenheim", minute, score_home: sh, score_away: sa, scorer });
  it("ricava la squadra dal punteggio dopo ogni gol, anche se le righe sono in disordine", () => {
    const m = goalsByMatch([g("22", "2", "0", "B"), g("5", "1", "0", "A"), g("62", "3", "1", "D"), g("27", "2", "1", "C")]);
    expect(m.get("2026-11-20|Darmstadt|Heidenheim")!.map((x) => `${x.minute}${x.side}`)).toEqual(["5h", "22h", "27a", "62h"]);
  });
  it("scarta le partite con punteggi incoerenti o mancanti", () => {
    expect(goalsByMatch([g("5", "1", "0"), g("22", "3", "0")]).size).toBe(0);
    expect(goalsByMatch([g("5", "", "")]).size).toBe(0);
  });
  it("aggiunge minuti con squadra e marcatori solo se tornano con il risultato", () => {
    const goals = goalsByMatch([g("5", "1", "0", "A"), g("22", "2", "0", "B"), g("27", "2", "1", "C"), g("62", "3", "1", "D")]).get("2026-11-20|Darmstadt|Heidenheim");
    const row = { home: "Darmstadt", away: "Heidenheim", match_date: "2026-11-20", fthg: 3, ftag: 1 };
    expect(withGoalSides(row, goals)).toMatchObject({ goal_min: "5h,22h,27a,62h", goal_by: "A|B|C|D" });
    expect(withGoalSides({ ...row, fthg: 2 }, goals)).toEqual({ ...row, fthg: 2 });
  });
});
