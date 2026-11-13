import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

it.each([
  ["az", /söz kartları|kartlarla/i],
  ["en", /flashcards/i],
  ["es", /flashcards/i],
  ["ja", /単語帳|フラッシュカード/],
  ["ko", /단어장|플래시카드/],
  ["ru", /карточк/i],
  ["tr", /kartlar|kartlarla/i],
  ["vi", /thẻ ghi nhớ/i],
  ["zh-CN", /背单词|闪卡/],
  ["zh-TW", /背單字|閃卡/],
])("%s extension metadata promises translation without cloud flashcards", (locale, unavailable) => {
  const yaml = readFileSync(new URL(`../../../locales/${locale}.yml`, import.meta.url), "utf8")
  const metadata = yaml.split("\n").filter((line) => /^ext(Name|Description):/.test(line))
  expect(metadata).toHaveLength(2)
  expect(metadata.join("\n")).not.toMatch(unavailable)
})
