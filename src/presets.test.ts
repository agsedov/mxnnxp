import { describe, expect, it } from 'vitest'
import { parsePresetCatalog } from './presets'

describe('parsePresetCatalog', () => {
  it('reads well-formed entries in order', () => {
    const text = JSON.stringify([
      { file: 'matrix.txt', en: 'One matrix', ru: 'Одна матрица' },
      { file: 'rotation.txt', en: 'Rotation', ru: 'Поворот' },
    ])
    expect(parsePresetCatalog(text)).toEqual([
      { file: 'matrix.txt', en: 'One matrix', ru: 'Одна матрица' },
      { file: 'rotation.txt', en: 'Rotation', ru: 'Поворот' },
    ])
  })

  it('skips entries that could make the fetched URL escape /presets/', () => {
    const text = JSON.stringify([
      { file: '../secrets.txt', en: 'Escaped', ru: 'Утёк' },
      { file: 'sub/dir.txt', en: 'Nested', ru: 'Вложен' },
      { file: '.hidden.txt', en: 'Hidden', ru: 'Скрытый' },
      { file: 'ok.txt', en: 'Ok', ru: 'Ок' },
    ])
    expect(parsePresetCatalog(text)).toEqual([{ file: 'ok.txt', en: 'Ok', ru: 'Ок' }])
  })

  it('skips entries with missing or non-string names', () => {
    const text = JSON.stringify([
      { file: 'a.txt', en: 'Named' },
      { file: 'b.txt', en: 7, ru: 'Число' },
      { en: 'Nameless', ru: 'Без имени' },
      { file: 'c.txt', en: 'Kept', ru: 'Сохранён' },
    ])
    expect(parsePresetCatalog(text)).toEqual([{ file: 'c.txt', en: 'Kept', ru: 'Сохранён' }])
  })

  it('degrades to an empty list for anything but a JSON array', () => {
    expect(parsePresetCatalog('not json at all')).toEqual([])
    expect(parsePresetCatalog('{"file":"a.txt"}')).toEqual([])
    expect(parsePresetCatalog('null')).toEqual([])
  })
})
