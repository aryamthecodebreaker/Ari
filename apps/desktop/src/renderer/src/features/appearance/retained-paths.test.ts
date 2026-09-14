import { describe, expect, it } from 'vitest'
import { retainedPaths } from './custom-background'

/**
 * The background cache holds only what this returns, so its length is the
 * memory bound: caching every picture visited grew with the library, and a
 * forty-image library at the reader's size limit held over a gigabyte.
 */
describe('retainedPaths', () => {
  const library = ['a.jpg', 'b.jpg', 'c.jpg']

  it('holds nothing for an empty library', () => {
    expect(retainedPaths([], 0, true)).toEqual([])
  })

  it('holds only the picture on screen when not rotating', () => {
    expect(retainedPaths(library, 1, false)).toEqual(['b.jpg'])
  })

  it('also holds the next picture while rotating, so the change has no blank frame', () => {
    expect(retainedPaths(library, 0, true)).toEqual(['a.jpg', 'b.jpg'])
  })

  it('wraps to the first picture after the last', () => {
    expect(retainedPaths(library, 2, true)).toEqual(['c.jpg', 'a.jpg'])
  })

  it('does not count a single picture twice when it is also next', () => {
    expect(retainedPaths(['only.jpg'], 0, true)).toEqual(['only.jpg'])
  })

  it('stays at two however large the library grows', () => {
    const big = Array.from({ length: 40 }, (_, i) => `${String(i)}.jpg`)
    for (const index of [0, 17, 39]) {
      expect(retainedPaths(big, index, true).length).toBeLessThanOrEqual(2)
    }
  })

  it('recovers when the index fell off a library that shrank', () => {
    expect(retainedPaths(library, 9, false)).toEqual(['a.jpg'])
  })
})
