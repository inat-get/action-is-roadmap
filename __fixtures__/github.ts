import { jest } from '@jest/globals'

export const context = {
  repo: {
    owner: 'test-owner',
    repo: 'test-repo'
  }
}

export const getOctokit = jest.fn(() => ({
  rest: {
    issues: {
      listMilestones: jest.fn(),
      listForRepo: jest.fn()
    }
  }
}))
