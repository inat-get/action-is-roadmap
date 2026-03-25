// src/config.ts
import * as fs from 'fs'
import * as yaml from 'js-yaml'

export interface StyleConfig {
  colors: {
    milestones: string[]
    issues: {
      open: string
      closed: string
    }
    arrows: {
      blocking: string
      chronological: string
      subIssues: string
    }
  }
  weights?: {
    blocking?: number
    chronological?: number
    subIssues?: number
  }
  shapes: {
    issue: string
  }
}

export const DEFAULT_CONFIG: StyleConfig = {
  colors: {
    milestones: ['#e1f5fe'],
    issues: {
      open: '#2da44e',
      closed: '#57606a'
    },
    arrows: {
      blocking: '#000000',
      chronological: '#666666',
      subIssues: '#0366d6'
    }
  },
  shapes: {
    issue: 'box'
  },
  weights: {
    blocking: 1,
    subIssues: 2,
    chronological: 4
  }
}

export function loadConfig(configPath: string): StyleConfig {
  try {
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG
    }
    const content = fs.readFileSync(configPath, 'utf8')
    const parsed = yaml.load(content) as Partial<StyleConfig>
    return {
      colors: {
        milestones:
          parsed.colors?.milestones || DEFAULT_CONFIG.colors.milestones,
        issues: {
          open:
            parsed.colors?.issues?.open || DEFAULT_CONFIG.colors.issues.open,
          closed:
            parsed.colors?.issues?.closed || DEFAULT_CONFIG.colors.issues.closed
        },
        arrows: {
          blocking:
            parsed.colors?.arrows?.blocking ||
            DEFAULT_CONFIG.colors.arrows.blocking,
          chronological:
            parsed.colors?.arrows?.chronological ||
            DEFAULT_CONFIG.colors.arrows.chronological,
          subIssues:
            parsed.colors?.arrows?.subIssues ||
            DEFAULT_CONFIG.colors.arrows.subIssues
        }
      },
      shapes: {
        issue: parsed.shapes?.issue || DEFAULT_CONFIG.shapes.issue
      }
    }
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error}`, {
      cause: error
    })
  }
}
