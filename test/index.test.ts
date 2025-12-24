import { describe, expect, it } from 'bun:test'

import { A } from '../src'

describe('should', () => {
  it('exported', () => {
    expect(A).toEqual('a')
  })
})
