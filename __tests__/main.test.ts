/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

// Mock the modules
const { run } = await import('../src/main.js')
const { fetchData } = await import('../src/github.js')
const { generateDiagram } = await import('../src/mermaid.js')
const { writeOutput } = await import('../src/output.js')
const { loadConfig } = await import('../src/config.js')

// Mock implementations
jest.unstable_mockModule('../src/github.js', () => ({
  fetchData: jest.fn<typeof fetchData>()
}))

jest.unstable_mockModule('../src/mermaid.js', () => ({
  generateDiagram: jest
    .fn<typeof generateDiagram>()
    .mockReturnValue('graph TD\nI1[Issue]')
}))

jest.unstable_mockModule('../src/output.js', () => ({
  writeOutput: jest.fn<typeof writeOutput>().mockResolvedValue(undefined)
}))

jest.unstable_mockModule('../src/config.js', () => ({
  loadConfig: jest.fn<typeof loadConfig>().mockReturnValue({
    colors: {
      milestones: ['#e1f5fe'],
      issues: { open: '#2da44e', closed: '#57606a' },
      arrows: { blocking: '#000000', chronological: '#666666' }
    },
    shapes: { issue: 'box' }
  }),
  DEFAULT_CONFIG: {}
}))

const mockedFetchData = (await import('../src/github.js')) as jest.Mocked<
  typeof import('../src/github.js')
>
const mockedGenerateDiagram =
  (await import('../src/mermaid.js')) as jest.Mocked<
    typeof import('../src/mermaid.js')
  >
const mockedWriteOutput = (await import('../src/output.js')) as jest.Mocked<
  typeof import('../src/output.js')
>

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
