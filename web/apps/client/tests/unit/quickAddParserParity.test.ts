import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { parseQuickAddLocally } from "../../src/lib/localQuickAddParser.ts";

type ParityCase = {
  name: string;
  input: string;
  expected: Record<string, unknown>;
};

const corpusUrl = new URL("../../../../../docs/specs/quickadd/parser-parity.json", import.meta.url);
const cases = JSON.parse(readFileSync(corpusUrl, "utf8")) as ParityCase[];

function normalized(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("quick-add parser shared parity corpus", () => {
  test("corpus is non-empty", () => {
    assert.ok(cases.length > 0);
  });

  for (const parityCase of cases) {
    test(parityCase.name, () => {
      assert.deepStrictEqual(normalized(parseQuickAddLocally(parityCase.input)), parityCase.expected);
    });
  }
});
