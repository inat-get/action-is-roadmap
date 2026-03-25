/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)

// Mock the modules
const { run } = await import('../src/main.js')

// Mock implementations
const mockedFetchData = jest.fn()
const mockedGenerateDiagram = jest.fn().mockReturnValue('graph TD\nI1[Issue]')
const mockedWriteOutput = jest.fn().mockResolvedValue(undefined)
const mockedLoadConfig = jest.fn().mockReturnValue({
  colors: {
    milestones: ['#e1f5fe'],
    issues: { open: '#2da44e', closed: '#57606a' },
    arrows: { blocking: '#000000', chronological: '#666666' }
  },
  shapes: { issue: 'box' }
})

jest.unstable_mockModule('../src/github.js', () => ({
  fetchData: mockedFetchData
}))

jest.unstable_mockModule('../src/mermaid.js', () => ({
  generateDiagram: mockedGenerateDiagram
}))

jest.unstable_mockModule('../src/output.js', () => ({
  writeOutput: mockedWriteOutput
}))

jest.unstable_mockModule('../src/config.js', () => ({
  loadConfig: mockedLoadConfig,
  DEFAULT_CONFIG: {}
}))

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: 'fake-token',
        output_type: 'file',
        output_path: 'ROADMAP.md',
        wiki_title: 'Roadmap',
        config_file: '.github/roadmap-styles.yml',
        exclude_label: ''
      }
      return inputs[name] || ''
    })

    // Reset mocks
    mockedFetchData.fetchData.mockReset()
    mockedGenerateDiagram.generateDiagram.mockReset()
    mockedWriteOutput.writeOutput.mockReset()
    core.setOutput.mockClear()
    core.setFailed.mockClear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Successfully generates roadmap', async () => {
    const mockMilestones = [
      {
        number: 1,
        title: 'v1.0',
        dueOn: '2024-01-15T00:00:00Z',
        state: 'open' as const
      }
    ]
    const mockIssues = [
      {
        number: 1,
        title: 'Feature A',
        state: 'open' as const,
        milestone: 'v1.0',
        labels: [],
        blockedBy: []
      }
    ]

    mockedFetchData.fetchData.mockResolvedValue({
      milestones: mockMilestones,
      issues: mockIssues
    })

    await run()

    // Verify fetchData was called
    expect(mockedFetchData.fetchData).toHaveBeenCalledWith('fake-token', null)

    // Verify generateDiagram was called
    expect(mockedGenerateDiagram.generateDiagram).toHaveBeenCalledWith(
      mockMilestones,
      mockIssues,
      expect.any(Object)
    )

    // Verify output was written
    expect(mockedWriteOutput.writeOutput).toHaveBeenCalledWith(
      'graph TD\nI1[Issue]',
      'file',
      'ROADMAP.md',
      'Roadmap',
      'fake-token'
    )

    // Verify output was set
    expect(core.setOutput).toHaveBeenCalledWith(
      'diagram',
      'graph TD\nI1[Issue]'
    )
  })

  it('Handles exclude_label parameter', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: 'fake-token',
        output_type: 'file',
        output_path: 'ROADMAP.md',
        wiki_title: 'Roadmap',
        config_file: '.github/roadmap-styles.yml',
        exclude_label: 'skip-roadmap'
      }
      return inputs[name] || ''
    })

    mockedFetchData.fetchData.mockResolvedValue({ milestones: [], issues: [] })

    await run()

    expect(mockedFetchData.fetchData).toHaveBeenCalledWith(
      'fake-token',
      'skip-roadmap'
    )
  })

  it('Sets failed status on error', async () => {
    mockedFetchData.fetchData.mockRejectedValue(new Error('API Error'))

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('API Error')
  })

  it('Handles wiki output type', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        github_token: 'fake-token',
        output_type: 'wiki',
        output_path: 'ROADMAP.md',
        wiki_title: 'Project Roadmap',
        config_file: '.github/roadmap-styles.yml',
        exclude_label: ''
      }
      return inputs[name] || ''
    })

    mockedFetchData.fetchData.mockResolvedValue({ milestones: [], issues: [] })

    await run()

    expect(mockedWriteOutput.writeOutput).toHaveBeenCalledWith(
      expect.any(String),
      'wiki',
      'ROADMAP.md',
      'Project Roadmap',
      'fake-token'
    )
  })
})
