// src/config.ts
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

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
    }
  }
  shapes: {
    issue: string
  }
}

export const DEFAULT_CONFIG: StyleConfig = {
  colors: {
    milestones: ['#e1f5fe', '#fff3e0', '#f3e5f5'],
    issues: {
      open: '#2da44e',
      closed: '#57606a'
    },
    arrows: {
      blocking: '#000000',
      chronological: '#666666'
    }
  },
  shapes: {
    issue: 'box'
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
            DEFAULT_CONFIG.colors.arrows.chronological
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
