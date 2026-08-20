import { describe, it, expect } from "vitest";
import { parseCsvRows, parseCsvObjects, toCsv } from "./csv.js";

describe("parseCsvRows", () => {
  it("splits a simple comma-separated row", () => {
    expect(parseCsvRows("a,b,c")).toEqual([["a", "b", "c"]]);
  });

  it("handles a quoted field containing a comma", () => {
    expect(parseCsvRows('Kwame,"Accra, Ghana",0241234567')).toEqual([
      ["Kwame", "Accra, Ghana", "0241234567"],
    ]);
  });

  it("handles a doubled-quote escape inside a quoted field", () => {
    expect(parseCsvRows('a,"She said ""hi""",c')).toEqual([["a", 'She said "hi"', "c"]]);
  });

  it("handles an embedded newline inside a quoted field", () => {
    expect(parseCsvRows('a,"line1\nline2",c')).toEqual([["a", "line1\nline2", "c"]]);
  });

  it("handles multiple rows separated by \\r\\n or \\n", () => {
    expect(parseCsvRows("a,b\r\nc,d\ne,f")).toEqual([["a", "b"], ["c", "d"], ["e", "f"]]);
  });

  it("ignores trailing blank lines", () => {
    expect(parseCsvRows("a,b\n\n")).toEqual([["a", "b"]]);
  });
});

describe("parseCsvObjects", () => {
  it("maps rows onto the header row's column names", () => {
    const { headers, records } = parseCsvObjects("name,phone\nKwame,0241234567\nAma,0551234567");
    expect(headers).toEqual(["name", "phone"]);
    expect(records).toEqual([
      { name: "Kwame", phone: "0241234567" },
      { name: "Ama", phone: "0551234567" },
    ]);
  });

  it("returns empty headers/records for empty input", () => {
    expect(parseCsvObjects("")).toEqual({ headers: [], records: [] });
  });

  it("trims whitespace around header names and values", () => {
    const { headers, records } = parseCsvObjects(" name , phone \n Kwame , 0241234567 ");
    expect(headers).toEqual(["name", "phone"]);
    expect(records).toEqual([{ name: "Kwame", phone: "0241234567" }]);
  });
});

describe("toCsv", () => {
  const columns = [{ key: "name", label: "Name" }, { key: "phone", label: "Phone", isPhone: true }];

  it("produces a header row followed by escaped data rows", () => {
    const csv = toCsv([{ name: "Kwame", phone: "0241234567" }], columns);
    expect(csv).toBe('Name,Phone\r\nKwame,="0241234567"');
  });

  it("quotes a value containing a comma", () => {
    const csv = toCsv([{ name: "Mensah, Kwame", phone: "" }], columns);
    expect(csv).toContain('"Mensah, Kwame"');
  });

  it("round-trips through parseCsvObjects for non-phone columns", () => {
    const plainColumns = [{ key: "a", label: "a" }, { key: "b", label: "b" }];
    const csv = toCsv([{ a: "x,y", b: 'say "hi"' }], plainColumns);
    const { records } = parseCsvObjects(csv);
    expect(records).toEqual([{ a: "x,y", b: 'say "hi"' }]);
  });
});
